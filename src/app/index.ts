import { type CalendarEventDetails, calculateEndTime, downloadCalendarFile } from "./calendar.js";
import { ChatController } from "./chat-controller.js";
import { getConfig, loadConfig } from "./config.js";
import { FileTransferController } from "./file-transfer-controller.js";
import { MediaController } from "./media-controller.js";
import { getLocalMediaWithFallback } from "./media-devices.js";
import { ModeratorController } from "./moderator-controller.js";
import { BrowserNotifier, type Notifier } from "./notifications.js";
import { PeerManager } from "./peer-manager.js";
import { ReactionController } from "./reaction-controller.js";
import { type ConnectionStatusEvent, SignalingClient } from "./signaling.js";
import type {
  LowerHandMessage,
  ModeratorActionMessage,
  ParticipantJoinedMessage,
  ParticipantLeftMessage,
  ParticipantUpdatedMessage,
  QualityChangeMessage,
  RaiseHandMessage,
  ReactionMessage,
  RejectUserMessage,
  RoomLockedMessage,
  RoomUnlockedMessage,
  SignalingMessage,
  WaitingRoomMessage,
} from "./types.js";
import { UIManager } from "./ui.js";

class MikroMeetApp {
  private ui: UIManager;
  private notifier: Notifier;
  private chatController: ChatController;
  private fileTransferController: FileTransferController;
  private mediaController: MediaController;
  private moderatorController: ModeratorController;
  private reactionController: ReactionController;
  private signaling: SignalingClient | null = null;
  private peerManager: PeerManager | null = null;
  private localStream: MediaStream | null = null;
  private roomId = "";
  private participantName = "";
  private participantId: string | null = null;
  private isMuted = false;
  private isVideoEnabled = true;
  private isHandRaised = false;
  private isModerator = false;
  private isRoomLocked = false;
  private isIncomingVideoDisabled = false;
  private isIncomingVideoManuallyDisabled = false;
  private isJoinLinkMode = false;
  private isCreatingRoom = false;
  private pendingCalendarEvent: CalendarEventDetails | null = null;

  constructor() {
    this.ui = new UIManager();
    this.notifier = new BrowserNotifier();
    this.chatController = new ChatController({
      ui: this.ui,
      getSignaling: () => this.signaling,
      getRoomId: () => this.roomId,
      getParticipantId: () => this.participantId,
      getPeerName: (participantId) => this.peerManager?.getPeer(participantId)?.name,
    });
    this.fileTransferController = new FileTransferController(
      this.ui,
      this.notifier,
      () => this.peerManager,
    );
    this.mediaController = new MediaController({
      ui: this.ui,
      notifier: this.notifier,
      getLocalStream: () => this.localStream,
      getPeerManager: () => this.peerManager,
      getSignaling: () => this.signaling,
      getRoomId: () => this.roomId,
      getParticipantId: () => this.participantId,
      isModerator: () => this.isModerator,
      isVideoEnabled: () => this.isVideoEnabled,
    });
    this.moderatorController = new ModeratorController({
      ui: this.ui,
      notifier: this.notifier,
      getSignaling: () => this.signaling,
      getRoomId: () => this.roomId,
      getParticipantId: () => this.participantId,
      isModerator: () => this.isModerator,
    });
    this.reactionController = new ReactionController({
      ui: this.ui,
      getSignaling: () => this.signaling,
      getRoomId: () => this.roomId,
      getParticipantId: () => this.participantId,
      getParticipantName: () => this.participantName,
      getPeerName: (participantId) => this.peerManager?.getPeer(participantId)?.name,
    });
    this.setupEventListeners();
    this.loadSavedName();
    this.checkUrlParams();
  }

  private loadSavedName(): void {
    const savedName = localStorage.getItem("MikroMeet-name");
    if (savedName) {
      this.ui.elements.nameInput.value = savedName;
    }
  }

  private saveName(name: string): void {
    localStorage.setItem("MikroMeet-name", name);
  }

  private checkUrlParams(): void {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(window.location.search);

    // Check for ?join=ROOMID parameter (mobile-friendly invite links)
    const joinRoomId = params.get("join");
    const token = params.get("creatorToken");
    if (joinRoomId) {
      if (token) {
        this.saveCreatorToken(joinRoomId.toUpperCase(), token);
      }
      this.roomId = joinRoomId; // Set room ID directly
      this.ui.elements.roomInput.value = joinRoomId;
      this.setupJoinLinkUI(joinRoomId);
      // Clean URL to remove join parameter
      window.history.replaceState({}, "", `${window.location.pathname}#${joinRoomId}`);
      return;
    }

    // Fallback to hash-based room ID
    if (hash) {
      this.ui.elements.roomInput.value = hash;
    }

    // Check for creator token in URL (from host link)
    if (token && hash) {
      this.saveCreatorToken(hash, token);
      // Clean the URL to avoid leaking the token
      window.history.replaceState({}, "", `${window.location.pathname}#${hash}`);
    }
  }

  private setupJoinLinkUI(_roomId: string): void {
    // Set flag so handleCreateMeeting() and Enter key redirect to handleJoin()
    this.isJoinLinkMode = true;

    // Show initial view with modified UI for joining via link
    this.ui.elements.landingInitial.classList.remove("hidden");
    this.ui.elements.landingJoin.classList.add("hidden");

    // Change primary button text to "Join Meeting"
    const span = this.ui.elements.btnCreateMeeting.querySelector("span");
    if (span) {
      span.textContent = "Join Meeting";
    }

    // Hide "Join with code" button since we already have the code
    this.ui.elements.btnShowJoin.style.display = "none";
  }

  private setupEventListeners(): void {
    // Landing page navigation
    this.ui.elements.btnCreateMeeting.addEventListener("click", () => {
      void this.handleCreateMeeting();
    });
    this.ui.elements.btnShowJoin.addEventListener("click", () => this.showJoinView());
    this.ui.elements.btnBackInitial.addEventListener("click", () => this.showInitialView());
    this.ui.elements.btnShowAdvanced.addEventListener("click", () => this.toggleAdvanced());
    this.ui.elements.btnCopyCreatedLink.addEventListener("click", () => this.copyCreatedLink());
    this.ui.elements.btnDownloadIcs.addEventListener("click", () => this.downloadCalendarInvite());
    this.ui.elements.btnJoinCreated.addEventListener("click", () => this.joinCreatedMeeting());

    // Enable/disable landing buttons based on name input
    this.ui.elements.nameInput.addEventListener("input", () => this.updateLandingButtons());
    this.updateLandingButtons(); // Initial state

    // Enter key on name input triggers "New Meeting Room"
    this.ui.elements.nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !this.ui.elements.btnCreateMeeting.disabled) {
        void this.handleCreateMeeting();
      }
    });

    // Join form
    this.ui.elements.joinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.handleJoin();
    });

    // Auto-extract meeting code from pasted URLs (use paste event to bypass maxlength truncation)
    this.ui.elements.roomInput.addEventListener("paste", (e) => {
      const pasted = e.clipboardData?.getData("text")?.trim();
      if (!pasted) return;

      // Only intercept if pasted text looks like a URL
      if (!pasted.includes("://") && !pasted.includes("#") && !pasted.includes("?join=")) return;

      e.preventDefault();
      let code = "";
      try {
        const url = new URL(pasted);
        // Check for ?join= parameter first
        code = url.searchParams.get("join") || url.hash.slice(1) || "";
      } catch {
        // Fallback: extract code after # or ?join=
        const joinMatch = pasted.match(/[?&]join=([A-Za-z0-9]+)/);
        const hashMatch = pasted.match(/#([A-Za-z0-9]+)/);
        code = joinMatch?.[1] || hashMatch?.[1] || "";
      }

      if (code) {
        this.ui.elements.roomInput.value = code.toUpperCase();
      }
    });

    // Control buttons
    this.ui.elements.btnMute.addEventListener("click", () => this.toggleMute());
    this.ui.elements.btnVideo.addEventListener("click", () => this.toggleVideo());
    this.ui.elements.btnScreen.addEventListener("click", () => {
      void this.mediaController.shareScreen();
    });
    this.ui.elements.btnIncomingVideo.addEventListener("click", () => this.toggleIncomingVideo());
    this.ui.elements.btnLeave.addEventListener("click", () => this.leaveMeeting());
    this.ui.elements.btnRetry.addEventListener("click", () => this.ui.showScreen("landing"));

    // Chat
    this.ui.elements.btnChat.addEventListener("click", () => this.ui.toggleChat());
    this.ui.elements.btnCloseChat.addEventListener("click", () => this.ui.closeChat());
    this.ui.elements.btnSendChat.addEventListener("click", () => this.chatController.sendMessage());
    this.ui.elements.btnSendFile.addEventListener("click", () => {
      this.ui.elements.chatFileInput.click();
    });
    this.ui.elements.chatFileInput.addEventListener("change", () => {
      void this.fileTransferController.sendSelectedFiles();
    });
    this.ui.elements.btnCancelReply.addEventListener("click", () =>
      this.chatController.clearReplyTarget(),
    );
    this.ui.elements.chatMessages.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-chat-action='reply']");
      const messageId = target?.dataset.messageId;
      if (messageId) this.chatController.setReplyTarget(messageId);
    });
    this.ui.elements.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.chatController.sendMessage();
    });

    // Participants panel
    this.ui.elements.btnParticipants.addEventListener("click", () => this.ui.toggleParticipants());
    this.ui.elements.btnCloseParticipants.addEventListener("click", () =>
      this.ui.closeParticipants(),
    );

    // Participants list actions (delegate)
    this.ui.elements.participantsList.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (action && id) {
        this.moderatorController.handleAction(action, id);
      }
    });

    // Hand raising
    this.ui.elements.btnHand.addEventListener("click", () => this.toggleHand());

    // Recording
    this.ui.elements.btnRecord.addEventListener("click", () => {
      void this.mediaController.toggleRecording();
    });

    // Room lock
    this.ui.elements.btnLock.addEventListener("click", () => this.toggleRoomLock());

    // Invite button
    this.ui.elements.btnInvite.addEventListener("click", () => this.copyInviteLink());

    // Reactions and pinning
    this.ui.elements.btnReactions.addEventListener("click", () => this.ui.toggleReactionPicker());
    this.ui.elements.reactionPicker.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-reaction]");
      const reaction = target?.dataset.reaction;
      if (!reaction) return;
      this.reactionController.sendReaction(reaction);
      this.ui.closeReactionPicker();
    });
    this.ui.elements.videoGrid.addEventListener("dblclick", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(".video-item.remote");
      const participantId = target?.dataset.participantId;
      if (participantId) this.ui.togglePinnedVideo(participantId);
    });

    // Mobile menu
    this.ui.elements.btnMore.addEventListener("click", () => this.ui.openMobileMenu());
    this.ui.elements.btnMobileChat.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      this.ui.toggleChat();
    });
    this.ui.elements.btnMobileParticipants.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      this.ui.toggleParticipants();
    });
    this.ui.elements.btnMobileScreen.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      void this.mediaController.shareScreen();
    });
    this.ui.elements.btnMobileRecord.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      void this.mediaController.toggleRecording();
    });
    this.ui.elements.btnMobileLock.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      this.toggleRoomLock();
    });
    this.ui.elements.btnMobileHand.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      this.toggleHand();
    });
    this.ui.elements.btnMobileIncomingVideo.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      this.toggleIncomingVideo();
    });
    this.ui.elements.btnMobileReactions.addEventListener("click", () => {
      this.ui.closeMobileMenu();
      this.ui.toggleReactionPicker();
    });

    // Window events
    window.addEventListener("beforeunload", () => this.cleanup());
    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
  }

  private async handleJoin(): Promise<void> {
    const formData = this.ui.getJoinFormData();

    if (!formData.name) {
      this.notifier.error("Please enter your name");
      return;
    }

    this.participantName = formData.name;
    this.saveName(formData.name);

    // Use room ID from form, or from this.roomId if already set, or generate new
    this.roomId = formData.roomId || this.roomId || this.generateRoomId();

    // Validate room ID format: exactly 6 alphanumeric characters
    if (!/^[A-Z0-9]{6}$/i.test(this.roomId)) {
      this.notifier.error(
        "Invalid meeting code. Must be exactly 6 characters (letters and numbers only).",
      );
      return;
    }

    // Uppercase for consistency
    this.roomId = this.roomId.toUpperCase();

    this.isVideoEnabled = formData.enableVideo;

    this.ui.showScreen("loading");
    this.ui.setJoinFormDisabled(true);

    try {
      // Load configuration first
      await loadConfig();
      const config = getConfig();

      const media = await getLocalMediaWithFallback({
        video: formData.enableVideo,
        audio: formData.enableAudio,
      });
      this.localStream = media.stream;
      this.isVideoEnabled = media.videoEnabled;
      this.isMuted = !media.audioEnabled;
      if (media.warning) {
        this.notifier.info(media.warning);
      }

      // Use configured WebSocket URL
      this.signaling = new SignalingClient(config.apiUrl);
      this.signaling.onStatus((event) => this.handleConnectionStatus(event));
      await this.signaling.connect();

      this.peerManager = new PeerManager(this.signaling, this.roomId, this.participantId ?? "");
      this.peerManager.setLocalStream(this.localStream);
      this.setupPeerEvents();

      this.fileTransferController.initialize(this.signaling, this.roomId, this.participantId ?? "");

      this.signaling.onMessage((message) => this.handleSignalingMessage(message));

      const storedToken = this.getCreatorToken(this.roomId);
      this.signaling.join(
        this.roomId,
        this.participantName,
        formData.password,
        this.isCreatingRoom,
        storedToken,
      );

      // Note: isModerator is set server-side based on who joins first
      // UI will update when server confirms participant status

      this.ui.setLocalStream(this.localStream);
      this.ui.setLocalName(this.participantName);
      this.ui.setRoomTitle(this.roomId);
      this.ui.setParticipantCount(1);
      this.ui.updateMuteButton(this.isMuted);
      this.ui.updateVideoButton(this.isVideoEnabled);
      this.ui.updateHandButton(this.isHandRaised);
      this.ui.updateRecordButton(false);
      this.ui.updateLockButton(this.isRoomLocked);
      // Meeting screen is shown when we receive participant-joined for ourselves
      // If room is locked, we'll get a waiting-room message and show the waiting screen instead

      window.history.replaceState({}, "", `#${this.roomId}`);
    } catch (error) {
      console.error("Failed to join:", error);
      this.ui.showError(this.getErrorMessage(error));
      this.cleanup();
    }
  }

  private async handleCreateMeeting(): Promise<void> {
    // If we arrived via a join link, redirect to handleJoin instead
    if (this.isJoinLinkMode) {
      void this.handleJoin();
      return;
    }

    const formData = this.ui.getJoinFormData();
    if (!formData.name) {
      this.notifier.error("Please enter your name");
      return;
    }

    this.participantName = formData.name;
    this.saveName(formData.name);

    const requestedRoomId = this.generateRoomId();
    const scheduledStart = formData.scheduledStart;
    const scheduledEnd =
      scheduledStart && formData.scheduledDurationMinutes
        ? calculateEndTime(scheduledStart, formData.scheduledDurationMinutes)
        : undefined;

    const reservedRoom = await this.reserveRoom({
      roomId: requestedRoomId,
      password: formData.password,
      maxParticipants: formData.maxParticipants,
      title: formData.title,
      scheduledStart,
      scheduledEnd,
    });

    this.roomId = reservedRoom?.roomId ?? requestedRoomId;
    this.isCreatingRoom = !reservedRoom;

    if (reservedRoom?.creatorToken) {
      this.saveCreatorToken(this.roomId, reservedRoom.creatorToken);
    }

    // Put the room ID in the room input so handleJoin() uses it
    this.ui.elements.roomInput.value = this.roomId;

    // Show the meeting created view with the link (mobile-friendly format)
    const url = `${window.location.origin}${window.location.pathname}?join=${this.roomId}`;
    this.pendingCalendarEvent =
      scheduledStart && scheduledEnd
        ? {
            title: formData.title || "MikroMeet meeting",
            startsAt: scheduledStart,
            endsAt: scheduledEnd,
            url,
          }
        : null;

    this.ui.elements.createdLink.value = url;
    this.updateCreatedDetails(formData.title, scheduledStart, scheduledEnd);
    this.ui.elements.landingInitial.classList.add("hidden");
    this.ui.elements.landingJoin.classList.add("hidden");
    this.ui.elements.landingAdvanced.classList.add("hidden");
    this.ui.elements.landingCreated.classList.remove("hidden");
  }

  private async reserveRoom(options: {
    roomId: string;
    password?: string;
    maxParticipants?: number;
    title?: string;
    scheduledStart?: number;
    scheduledEnd?: number;
  }): Promise<{
    roomId: string;
    creatorToken: string;
  } | null> {
    try {
      await loadConfig();
      const response = await fetch(this.getApiUrl("/api/rooms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      if (!response.ok) return null;
      return (await response.json()) as { roomId: string; creatorToken: string };
    } catch {
      return null;
    }
  }

  private getApiUrl(pathname: string): string {
    const config = getConfig();
    const url = new URL(config.apiUrl, window.location.href);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  private updateCreatedDetails(
    title?: string,
    scheduledStart?: number,
    scheduledEnd?: number,
  ): void {
    const details = this.ui.elements.createdDetails;
    details.textContent = "";

    if (title) {
      const titleElement = document.createElement("p");
      titleElement.textContent = title;
      details.appendChild(titleElement);
    }

    if (scheduledStart && scheduledEnd) {
      const timeElement = document.createElement("p");
      timeElement.textContent = `${new Date(scheduledStart).toLocaleString()} - ${new Date(
        scheduledEnd,
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      details.appendChild(timeElement);
    }

    details.classList.toggle("hidden", details.children.length === 0);
    this.ui.elements.btnDownloadIcs.classList.toggle("hidden", !this.pendingCalendarEvent);
  }

  private downloadCalendarInvite(): void {
    if (!this.pendingCalendarEvent) return;
    downloadCalendarFile(this.pendingCalendarEvent);
  }

  private joinCreatedMeeting(): void {
    // Join the meeting that was just created
    void this.handleJoin();
  }

  private showJoinView(): void {
    this.ui.elements.landingInitial.classList.add("hidden");
    this.ui.elements.landingJoin.classList.remove("hidden");
  }

  private showInitialView(): void {
    this.ui.elements.landingJoin.classList.add("hidden");
    this.ui.elements.landingCreated.classList.add("hidden");
    this.ui.elements.landingInitial.classList.remove("hidden");
  }

  private toggleAdvanced(): void {
    this.ui.elements.landingAdvanced.classList.toggle("hidden");
  }

  private updateLandingButtons(): void {
    const hasName = this.ui.elements.nameInput.value.trim().length > 0;
    this.ui.elements.btnCreateMeeting.disabled = !hasName;
    this.ui.elements.btnShowJoin.disabled = !hasName;
  }

  private copyCreatedLink(): void {
    const link = this.ui.elements.createdLink.value;
    void navigator.clipboard.writeText(link).then(() => {
      const button = this.ui.elements.btnCopyCreatedLink;
      const icon = button.querySelector("use");
      if (icon) icon.setAttribute("href", "#icon-check");

      setTimeout(() => {
        if (icon) icon.setAttribute("href", "#icon-link");
      }, 2000);
    });
  }

  private setupPeerEvents(): void {
    if (!this.peerManager) return;

    // Start continuous quality monitoring
    this.peerManager.startQualityMonitoring();

    this.peerManager.onEvent((event) => {
      switch (event.type) {
        case "stream-added":
          if (event.participantId && event.stream) {
            const peer = this.peerManager?.getPeer(event.participantId);
            if (peer) {
              this.ui.addRemoteVideo(peer);
              this.ui.updateRemoteVideoStream(event.participantId, event.stream);
              this.updateParticipantCount();
              this.updateParticipantsList();
            }
          }
          break;
        case "stream-removed":
          if (event.participantId) {
            this.ui.removeRemoteVideo(event.participantId);
            this.updateParticipantCount();
            this.updateParticipantsList();
          }
          break;
        case "connection-state-change":
          if (event.participantId && event.connectionState) {
            void (async () => {
              const quality = await this.peerManager?.getConnectionQuality(event.participantId);
              if (quality) {
                this.handleNetworkQualityChange(quality);
                this.ui.updateConnectionQuality(quality);
              }
            })();
          }
          break;
        case "quality-updated":
          if (event.participantId && event.quality) {
            this.handleNetworkQualityChange(event.quality);
            this.ui.updateConnectionQuality(event.quality);
          }
          break;
        case "error":
          console.error("Peer error:", event.error);
          break;
      }
    });
  }

  private handleConnectionStatus(event: ConnectionStatusEvent): void {
    switch (event.status) {
      case "connected":
        this.ui.updateConnectionStatus("connected");
        break;
      case "reconnecting":
        this.ui.updateConnectionStatus(
          "reconnecting",
          `Reconnecting ${event.attempt ?? 1}/${event.maxAttempts ?? 5}`,
        );
        break;
      case "reconnected":
        this.resetPeerStateAfterReconnect();
        this.ui.updateConnectionStatus("reconnected", "Reconnected");
        setTimeout(() => this.ui.updateConnectionStatus("connected"), 1800);
        break;
      case "failed":
        this.ui.updateConnectionStatus("failed", "Connection lost");
        break;
      case "disconnected":
        this.ui.updateConnectionStatus("disconnected", "Disconnected");
        break;
    }
  }

  private resetPeerStateAfterReconnect(): void {
    this.peerManager?.closeAll();
    this.ui.clearRemoteVideos();
    this.participantId = null;
    this.peerManager?.setParticipantId("");
    this.fileTransferController.setParticipantId("");
    this.updateParticipantCount();
    this.updateParticipantsList();
  }

  private handleSignalingMessage(message: SignalingMessage): void {
    try {
      switch (message.type) {
        case "participant-joined":
          void this.handleParticipantJoined(message);
          break;
        case "participant-left":
          this.handleParticipantLeft(message);
          break;
        case "participant-updated":
          this.handleParticipantUpdated(message);
          break;
        case "offer":
          void this.handleOffer(message);
          break;
        case "answer":
          void this.handleAnswer(message);
          break;
        case "ice-candidate":
          void this.handleIceCandidate(message);
          break;
        case "chat":
          this.chatController.handleMessage(message);
          break;
        case "file-offer":
          this.fileTransferController.handleOffer(
            message,
            this.peerManager?.getPeer(message.participantId)?.name ?? "Unknown",
          );
          break;
        case "file-answer":
          this.fileTransferController.handleAnswer(message);
          break;
        case "file-chunk":
          this.fileTransferController.handleChunk(message);
          break;
        case "moderator-action":
          this.handleModeratorActionMessage(message);
          break;
        case "room-locked":
          this.handleRoomLocked(message);
          break;
        case "room-unlocked":
          this.handleRoomUnlocked(message);
          break;
        case "waiting-room":
          this.handleWaitingRoom(message);
          break;
        case "admit-user":
          this.handleAdmitUser();
          break;
        case "reject-user":
          this.handleRejectUser(message);
          break;
        case "raise-hand":
          this.handleRaiseHand(message);
          break;
        case "lower-hand":
          this.handleLowerHand(message);
          break;
        case "recording-started":
          this.mediaController.handleRecordingStarted(message);
          break;
        case "recording-stopped":
          this.mediaController.handleRecordingStopped(message);
          break;
        case "reaction":
          this.reactionController.handleReaction(message as ReactionMessage);
          break;
        case "quality-change":
          this.handleQualityChange(message);
          break;
        case "error":
          if (message.code === "INVALID_PASSWORD") {
            this.ui.showError("Invalid room password");
            this.cleanup();
          } else if (message.code === "ROOM_NOT_FOUND") {
            this.ui.showError("Meeting not found. Check the code and try again.");
            this.cleanup();
          } else if (message.code === "ROOM_FULL") {
            this.ui.showError("Room is full");
            this.cleanup();
          } else if (message.code === "UNAUTHORIZED") {
            this.notifier.error(message.message);
          } else {
            this.ui.showError(message.message);
          }
          break;
      }
    } catch (error) {
      console.error("[handleSignalingMessage] Error handling message:", message.type, error);
    }
  }

  private async handleParticipantJoined(message: ParticipantJoinedMessage): Promise<void> {
    // Initialize our participant ID only once (when we first join)
    if (this.participantId === null) {
      this.participantId = message.participantId;
      this.peerManager?.setParticipantId(message.participantId);
      this.fileTransferController.setParticipantId(message.participantId);
      this.ui.elements.localVideoContainer.dataset.participantId = message.participantId;
    }

    // Prevent connecting to ourselves
    if (message.participantId === this.participantId) {
      // If we just joined, set moderator flag from server payload
      // Server always sends isModerator, so we should use it directly
      this.isModerator = message.isModerator;
      this.ui.updateModeratorControls(this.isModerator);
      this.signaling?.updateParticipantState(this.roomId, this.participantId ?? "", {
        isMuted: this.isMuted,
        isVideoOff: !this.isVideoEnabled,
      });
      this.ui.showScreen("meeting");
      // Local video srcObject was set while the meeting screen was still hidden,
      // so autoplay may have silently failed. Kick it now that we're visible.
      void this.ui.elements.localVideo.play();
      this.updateParticipantsList();
      return;
    }

    // This is another participant joining, create a peer connection
    // Use lexicographic comparison to deterministically decide who initiates
    const shouldInitiate =
      this.participantId !== null && this.participantId < message.participantId;
    if (this.peerManager) {
      await this.peerManager.createPeerConnection(
        message.participantId,
        message.name,
        shouldInitiate,
      );
      this.peerManager.updatePeerState(message.participantId, {
        isModerator: message.isModerator,
        isMuted: message.isMuted,
        isVideoOff: message.isVideoOff,
      });
      this.ui.updatePeerStatus(message.participantId, {
        isModerator: message.isModerator,
        isMuted: message.isMuted,
        isVideoOff: message.isVideoOff,
      });
    }

    this.updateParticipantsList();
  }

  private handleParticipantLeft(message: ParticipantLeftMessage): void {
    this.peerManager?.removePeer(message.participantId);
    this.updateParticipantCount();
    this.updateParticipantsList();
  }

  private handleParticipantUpdated(message: ParticipantUpdatedMessage): void {
    this.peerManager?.updatePeerState(message.participantId, {
      isModerator: message.isModerator,
      isMuted: message.isMuted,
      isVideoOff: message.isVideoOff,
      isHandRaised: message.isHandRaised,
    });
    this.ui.updatePeerStatus(message.participantId, {
      isModerator: message.isModerator,
      isMuted: message.isMuted,
      isHandRaised: message.isHandRaised,
      isVideoOff: message.isVideoOff,
    });
    this.updateParticipantsList();
  }

  private async handleOffer(message: SignalingMessage): Promise<void> {
    if (!("sdp" in message && "targetId" in message)) return;
    const existingPeer = this.peerManager?.getPeer(message.participantId);
    await this.peerManager?.handleOffer(
      message.participantId,
      existingPeer?.name ?? "Participant",
      message.sdp as string,
    );
  }

  private async handleAnswer(message: SignalingMessage): Promise<void> {
    if (!("sdp" in message)) return;
    await this.peerManager?.handleAnswer(message.participantId, message.sdp as string);
  }

  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    if (!("candidate" in message)) return;
    await this.peerManager?.handleIceCandidate(
      message.participantId,
      message.candidate as RTCIceCandidateInit,
    );
  }

  private handleModeratorActionMessage(message: ModeratorActionMessage): void {
    if (message.targetId !== this.participantId) return;

    switch (message.action) {
      case "mute":
        if (!this.isMuted) this.toggleMute();
        break;
      case "unmute":
        if (this.isMuted) this.toggleMute();
        break;
      case "kick":
        this.notifier.info("You have been removed from the meeting by a moderator");
        this.leaveMeeting(false);
        break;
      case "make-moderator":
        this.isModerator = true;
        this.ui.updateModeratorControls(true);
        this.updateParticipantsList();
        this.notifier.info("You are now a moderator");
        break;
    }
  }

  private handleRoomLocked(_message: RoomLockedMessage): void {
    this.isRoomLocked = true;
    this.ui.updateLockButton(true);
  }

  private handleRoomUnlocked(_message: RoomUnlockedMessage): void {
    this.isRoomLocked = false;
    this.ui.updateLockButton(false);
  }

  private handleWaitingRoom(message: WaitingRoomMessage): void {
    // If we don't have a participantId yet, this message is telling US we're in the waiting room
    if (this.participantId === null) {
      this.ui.showScreen("waiting");
      return;
    }

    this.moderatorController.handleWaitingRoom(message);
  }

  private handleAdmitUser(): void {
    // Meeting screen will be shown when we receive participant-joined from the server
  }

  private handleRejectUser(message: RejectUserMessage): void {
    this.ui.showError(`Rejected from room: ${message.reason}`);
    this.cleanup();
  }

  private handleRaiseHand(message: RaiseHandMessage): void {
    this.peerManager?.updatePeerState(message.participantId, {
      isHandRaised: true,
    });
    this.ui.updatePeerStatus(message.participantId, { isHandRaised: true });
    this.updateParticipantsList();
  }

  private handleLowerHand(message: LowerHandMessage): void {
    this.peerManager?.updatePeerState(message.participantId, {
      isHandRaised: false,
    });
    this.ui.updatePeerStatus(message.participantId, { isHandRaised: false });
    this.updateParticipantsList();
  }

  private handleQualityChange(message: QualityChangeMessage): void {
    this.peerManager?.changeVideoQuality(message.participantId, message.quality);
  }

  private toggleMute(): void {
    if (!this.localStream) return;

    const audioTracks = this.localStream.getAudioTracks();
    this.isMuted = !this.isMuted;

    for (const track of audioTracks) {
      track.enabled = !this.isMuted;
    }

    this.ui.updateMuteButton(this.isMuted);
    this.signaling?.updateParticipantState(this.roomId, this.participantId ?? "", {
      isMuted: this.isMuted,
    });
  }

  private toggleVideo(): void {
    if (!this.localStream) return;

    const videoTracks = this.localStream.getVideoTracks();
    this.isVideoEnabled = !this.isVideoEnabled;

    for (const track of videoTracks) {
      track.enabled = this.isVideoEnabled;
    }

    this.ui.updateVideoButton(this.isVideoEnabled);
    this.signaling?.updateParticipantState(this.roomId, this.participantId ?? "", {
      isVideoOff: !this.isVideoEnabled,
    });
  }

  private handleNetworkQualityChange(quality: "good" | "fair" | "poor" | "unknown"): void {
    // Auto-disable incoming video on poor quality (if not manually disabled)
    if (
      quality === "poor" &&
      !this.isIncomingVideoDisabled &&
      !this.isIncomingVideoManuallyDisabled
    ) {
      this.isIncomingVideoDisabled = true;
      this.peerManager?.disableIncomingVideos();
      this.ui.updateIncomingVideoButton(true);
    }

    // Auto-re-enable when quality recovers (if not manually disabled)
    if (
      quality === "good" &&
      this.isIncomingVideoDisabled &&
      !this.isIncomingVideoManuallyDisabled
    ) {
      this.isIncomingVideoDisabled = false;
      this.peerManager?.enableIncomingVideos();
      this.ui.updateIncomingVideoButton(false);
    }
  }

  private toggleIncomingVideo(): void {
    this.isIncomingVideoManuallyDisabled = !this.isIncomingVideoManuallyDisabled;
    this.isIncomingVideoDisabled = this.isIncomingVideoManuallyDisabled;

    if (this.isIncomingVideoManuallyDisabled) {
      this.peerManager?.disableIncomingVideos();
    } else {
      this.peerManager?.enableIncomingVideos();
    }

    this.ui.updateIncomingVideoButton(this.isIncomingVideoManuallyDisabled);
  }

  private toggleHand(): void {
    this.isHandRaised = !this.isHandRaised;
    this.ui.updateHandButton(this.isHandRaised);

    if (this.isHandRaised) {
      this.signaling?.raiseHand(this.roomId, this.participantId ?? "");
    } else {
      this.signaling?.lowerHand(this.roomId, this.participantId ?? "");
    }
  }

  private toggleRoomLock(): void {
    if (!this.isModerator) {
      this.notifier.error("Only moderators can lock/unlock the room");
      return;
    }

    if (this.isRoomLocked) {
      this.signaling?.unlockRoom(this.roomId, this.participantId ?? "");
    } else {
      this.signaling?.lockRoom(this.roomId, this.participantId ?? "");
    }
  }

  private copyInviteLink(): void {
    const url = `${window.location.origin}${window.location.pathname}?join=${this.roomId}`;
    void navigator.clipboard.writeText(url).then(() => {
      const button = this.ui.elements.btnInvite;
      const iconUse = button.querySelector("svg.icon use") as SVGUseElement | null;
      const span = button.querySelector("span");
      const originalHref = iconUse?.getAttribute("href");
      const originalText = span?.textContent;

      // Swap icon to checkmark and flash green
      if (iconUse) iconUse.setAttribute("href", "#icon-check");
      if (span) span.textContent = "Copied!";
      button.classList.add("invite-copied");

      setTimeout(() => {
        if (iconUse && originalHref) iconUse.setAttribute("href", originalHref);
        if (span && originalText) span.textContent = originalText;
        button.classList.remove("invite-copied");
      }, 2000);
    });
  }

  private saveCreatorToken(roomId: string, token: string): void {
    const tokens = this.getStoredTokens();
    tokens[roomId] = token;
    localStorage.setItem("MikroMeet-creator-tokens", JSON.stringify(tokens));
  }

  private getCreatorToken(roomId: string): string | undefined {
    const tokens = this.getStoredTokens();
    return tokens[roomId];
  }

  private getStoredTokens(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem("MikroMeet-creator-tokens") ?? "{}");
    } catch {
      return {};
    }
  }

  private leaveMeeting(confirmLeave = true): void {
    if (confirmLeave && !this.notifier.confirm("Leave the meeting?")) return;

    this.cleanup();
    this.ui.showScreen("landing");
    this.ui.clearForm();
    this.ui.setJoinFormDisabled(false);
    window.history.replaceState({}, "", window.location.pathname);
  }

  private cleanup(): void {
    this.mediaController.cleanup();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.peerManager?.stopQualityMonitoring();
    this.peerManager?.closeAll();
    this.peerManager = null;

    this.fileTransferController.reset();

    // Send leave message before disconnecting
    if (this.signaling && this.roomId && this.participantId) {
      this.signaling.leave(this.roomId, this.participantId);
    }
    this.signaling?.disconnect();
    this.signaling = null;

    this.ui.setLocalStream(null);
    delete this.ui.elements.localVideoContainer.dataset.participantId;
    this.ui.clearRemoteVideos();
    this.ui.closeReactionPicker();
    this.ui.updateHandButton(false);
    this.ui.updateConnectionStatus("connected");

    // Reset session state
    this.participantId = null;
    this.isMuted = false;
    this.isVideoEnabled = true;
    this.isHandRaised = false;
    this.isModerator = false;
    this.isRoomLocked = false;
    this.roomId = "";
    this.isCreatingRoom = false;
    this.pendingCalendarEvent = null;
    this.chatController.reset();
    this.moderatorController.reset();
  }

  private updateParticipantCount(): void {
    const count = 1 + (this.peerManager?.getAllPeers().length ?? 0);
    this.ui.setParticipantCount(count);
  }

  private updateParticipantsList(): void {
    const peers = this.peerManager?.getAllPeers() ?? [];
    const participants = [
      {
        id: this.participantId ?? "local",
        name: this.participantName,
        isModerator: this.isModerator,
        isMuted: this.isMuted,
        isHandRaised: this.isHandRaised,
        isMe: true,
      },
      ...peers.map((peer) => ({
        id: peer.participantId,
        name: peer.name,
        isModerator: peer.isModerator,
        isMuted: peer.isMuted,
        isHandRaised: peer.isHandRaised,
        isMe: false,
      })),
    ];

    this.ui.updateParticipantsList(participants, this.isModerator);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.ui.elements.localVideo.pause();
    } else {
      void this.ui.elements.localVideo.play();
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        return "Camera/microphone access denied. Please check your permissions.";
      }
      if (error.name === "NotFoundError") {
        return "Camera or microphone not found. Please check your devices.";
      }
      return error.message;
    }
    return "An unexpected error occurred. Please try again.";
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new MikroMeetApp();
});
