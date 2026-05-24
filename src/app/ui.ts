import type { ChatMessageUI, FileTransfer, PeerConnection } from "./types.js";
import {
  createChatMessageElement,
  createFileTransferItem,
  createParticipantListItem,
  createRemoteVideoElement,
  createWaitingRoomItem,
  escapeAttr,
  type FileTransferActions,
  type ParticipantListItem,
} from "./ui-renderers.js";
import { createReactionIcon } from "./reaction-icons.js";

export interface UIElements {
  // Screens
  landing: HTMLElement;
  loading: HTMLElement;
  meeting: HTMLElement;
  error: HTMLElement;
  waiting: HTMLElement;

  // Landing views
  landingInitial: HTMLElement;
  landingJoin: HTMLElement;
  landingAdvanced: HTMLElement;
  landingCreated: HTMLElement;

  // Form elements
  joinForm: HTMLFormElement;
  nameInput: HTMLInputElement;
  roomInput: HTMLInputElement;
  roomPasswordInput: HTMLInputElement;
  joinPasswordInput: HTMLInputElement;
  maxParticipantsInput: HTMLInputElement;
  meetingTitleInput: HTMLInputElement;
  scheduledStartInput: HTMLInputElement;
  scheduledDurationInput: HTMLInputElement;
  btnCreateMeeting: HTMLButtonElement;
  btnShowJoin: HTMLButtonElement;
  btnShowAdvanced: HTMLButtonElement;
  btnBackInitial: HTMLButtonElement;
  createdLink: HTMLInputElement;
  createdDetails: HTMLElement;
  btnCopyCreatedLink: HTMLButtonElement;
  btnDownloadIcs: HTMLButtonElement;
  btnJoinCreated: HTMLButtonElement;

  // Meeting elements
  roomTitle: HTMLElement;
  participantCount: HTMLElement;
  videoGrid: HTMLElement;
  localVideo: HTMLVideoElement;
  localVideoContainer: HTMLElement;
  localMutedIndicator: HTMLElement;
  localVideoOffIndicator: HTMLElement;
  localHandIndicator: HTMLElement;
  recordingIndicator: HTMLElement;
  lockIndicator: HTMLElement;
  connectionQuality: HTMLElement;
  connectionStatus: HTMLElement;

  // Controls
  btnMute: HTMLButtonElement;
  btnVideo: HTMLButtonElement;
  btnScreen: HTMLButtonElement;
  btnLeave: HTMLButtonElement;
  btnChat: HTMLButtonElement;
  btnHand: HTMLButtonElement;
  btnRecord: HTMLButtonElement;
  btnLock: HTMLButtonElement;
  btnParticipants: HTMLButtonElement;
  btnMore: HTMLButtonElement;
  btnInvite: HTMLButtonElement;
  btnIncomingVideo: HTMLButtonElement;
  btnReactions: HTMLButtonElement;
  reactionPicker: HTMLElement;

  // Mobile menu
  mobileMenu: HTMLElement;
  btnMobileChat: HTMLButtonElement;
  btnMobileParticipants: HTMLButtonElement;
  btnMobileScreen: HTMLButtonElement;
  btnMobileRecord: HTMLButtonElement;
  btnMobileLock: HTMLButtonElement;
  btnMobileHand: HTMLButtonElement;
  btnMobileIncomingVideo: HTMLButtonElement;
  btnMobileReactions: HTMLButtonElement;

  // Chat
  chatPanel: HTMLElement;
  chatMessages: HTMLElement;
  chatReplyPreview: HTMLElement;
  chatReplyName: HTMLElement;
  chatReplyText: HTMLElement;
  chatInput: HTMLInputElement;
  chatFileInput: HTMLInputElement;
  btnSendChat: HTMLButtonElement;
  btnSendFile: HTMLButtonElement;
  btnCancelReply: HTMLButtonElement;
  btnCloseChat: HTMLButtonElement;
  chatUnread: HTMLElement;
  chatUnreadMobile: HTMLElement;

  // Participants panel
  participantsPanel: HTMLElement;
  participantsList: HTMLElement;
  btnCloseParticipants: HTMLButtonElement;

  // Waiting room
  waitingRoomSection: HTMLElement;
  waitingRoomList: HTMLElement;
  btnAdmitAll: HTMLButtonElement;

  // File transfer
  fileTransferPanel: HTMLElement;
  fileTransferList: HTMLElement;

  // Error
  errorMessage: HTMLElement;
  btnRetry: HTMLButtonElement;

  // Video navigation
  videoNavPrev: HTMLButtonElement;
  videoNavNext: HTMLButtonElement;
  videoPagination: HTMLElement;
  videoPageIndicator: HTMLElement;
}

export class UIManager {
  public elements: UIElements;
  private remoteVideos: Map<string, HTMLElement> = new Map();
  private allVideoIds: string[] = [];
  private currentPage = 0;
  private videosPerPage = 4;
  private chatVisible = false;
  private participantsVisible = false;
  private touchStartX = 0;
  private touchEndX = 0;
  private pinnedVideoId: string | null = null;

  constructor() {
    this.elements = {
      // Screens
      landing: document.getElementById("landing")!,
      loading: document.getElementById("loading")!,
      meeting: document.getElementById("meeting")!,
      error: document.getElementById("error")!,
      waiting: document.getElementById("waiting")!,

      // Landing views
      landingInitial: document.getElementById("landing-initial")!,
      landingJoin: document.getElementById("landing-join")!,
      landingAdvanced: document.getElementById("landing-advanced")!,
      landingCreated: document.getElementById("landing-created")!,

      // Form elements
      joinForm: document.getElementById("join-form")! as HTMLFormElement,
      nameInput: document.getElementById("name")! as HTMLInputElement,
      roomInput: document.getElementById("room")! as HTMLInputElement,
      roomPasswordInput: document.getElementById("room-password")! as HTMLInputElement,
      joinPasswordInput: document.getElementById("join-password")! as HTMLInputElement,
      maxParticipantsInput: document.getElementById("max-participants")! as HTMLInputElement,
      meetingTitleInput: document.getElementById("meeting-title")! as HTMLInputElement,
      scheduledStartInput: document.getElementById("scheduled-start")! as HTMLInputElement,
      scheduledDurationInput: document.getElementById("scheduled-duration")! as HTMLInputElement,
      btnCreateMeeting: document.getElementById("btn-create-meeting")! as HTMLButtonElement,
      btnShowJoin: document.getElementById("btn-show-join")! as HTMLButtonElement,
      btnShowAdvanced: document.getElementById("btn-show-advanced")! as HTMLButtonElement,
      btnBackInitial: document.getElementById("btn-back-initial")! as HTMLButtonElement,
      createdLink: document.getElementById("created-link")! as HTMLInputElement,
      createdDetails: document.getElementById("created-details")!,
      btnCopyCreatedLink: document.getElementById("btn-copy-created-link")! as HTMLButtonElement,
      btnDownloadIcs: document.getElementById("btn-download-ics")! as HTMLButtonElement,
      btnJoinCreated: document.getElementById("btn-join-created")! as HTMLButtonElement,

      // Meeting elements
      roomTitle: document.getElementById("room-title")!,
      participantCount: document.getElementById("participant-count")!,
      videoGrid: document.getElementById("video-grid")!,
      localVideo: document.getElementById("local-video")! as HTMLVideoElement,
      localVideoContainer: document.getElementById("local-video-container")!,
      localMutedIndicator: document.getElementById("local-muted")!,
      localVideoOffIndicator: document.getElementById("local-video-off")!,
      localHandIndicator: document.getElementById("local-hand")!,
      recordingIndicator: document.getElementById("recording-indicator")!,
      lockIndicator: document.getElementById("lock-indicator")!,
      connectionQuality: document.getElementById("connection-quality")!,
      connectionStatus: document.getElementById("connection-status")!,

      // Controls
      btnMute: document.getElementById("btn-mute")! as HTMLButtonElement,
      btnVideo: document.getElementById("btn-video")! as HTMLButtonElement,
      btnScreen: document.getElementById("btn-screen")! as HTMLButtonElement,
      btnLeave: document.getElementById("btn-leave")! as HTMLButtonElement,
      btnChat: document.getElementById("btn-chat")! as HTMLButtonElement,
      btnHand: document.getElementById("btn-hand")! as HTMLButtonElement,
      btnRecord: document.getElementById("btn-record")! as HTMLButtonElement,
      btnLock: document.getElementById("btn-lock")! as HTMLButtonElement,
      btnParticipants: document.getElementById("btn-participants")! as HTMLButtonElement,
      btnMore: document.getElementById("btn-more")! as HTMLButtonElement,
      btnInvite: document.getElementById("btn-invite")! as HTMLButtonElement,
      btnIncomingVideo: document.getElementById("btn-incoming-video")! as HTMLButtonElement,
      btnReactions: document.getElementById("btn-reactions")! as HTMLButtonElement,
      reactionPicker: document.getElementById("reaction-picker")!,

      // Mobile menu
      mobileMenu: document.getElementById("mobile-menu")!,
      btnMobileChat: document.getElementById("btn-mobile-chat")! as HTMLButtonElement,
      btnMobileParticipants: document.getElementById(
        "btn-mobile-participants",
      )! as HTMLButtonElement,
      btnMobileScreen: document.getElementById("btn-mobile-screen")! as HTMLButtonElement,
      btnMobileRecord: document.getElementById("btn-mobile-record")! as HTMLButtonElement,
      btnMobileLock: document.getElementById("btn-mobile-lock")! as HTMLButtonElement,
      btnMobileHand: document.getElementById("btn-mobile-hand")! as HTMLButtonElement,
      btnMobileIncomingVideo: document.getElementById(
        "btn-mobile-incoming-video",
      )! as HTMLButtonElement,
      btnMobileReactions: document.getElementById("btn-mobile-reactions")! as HTMLButtonElement,

      // Chat
      chatPanel: document.getElementById("chat-panel")!,
      chatMessages: document.getElementById("chat-messages")!,
      chatReplyPreview: document.getElementById("chat-reply-preview")!,
      chatReplyName: document.getElementById("chat-reply-name")!,
      chatReplyText: document.getElementById("chat-reply-text")!,
      chatInput: document.getElementById("chat-input")! as HTMLInputElement,
      chatFileInput: document.getElementById("chat-file-input")! as HTMLInputElement,
      btnSendChat: document.getElementById("btn-send-chat")! as HTMLButtonElement,
      btnSendFile: document.getElementById("btn-send-file")! as HTMLButtonElement,
      btnCancelReply: document.getElementById("btn-cancel-reply")! as HTMLButtonElement,
      btnCloseChat: document.getElementById("btn-close-chat")! as HTMLButtonElement,
      chatUnread: document.getElementById("chat-unread")!,
      chatUnreadMobile: document.getElementById("chat-unread-mobile")!,

      // Participants panel
      participantsPanel: document.getElementById("participants-panel")!,
      participantsList: document.getElementById("participants-list")!,
      btnCloseParticipants: document.getElementById("btn-close-participants")! as HTMLButtonElement,

      // Waiting room
      waitingRoomSection: document.getElementById("waiting-room-section")!,
      waitingRoomList: document.getElementById("waiting-room-list")!,
      btnAdmitAll: document.getElementById("btn-admit-all")! as HTMLButtonElement,

      // File transfer
      fileTransferPanel: document.getElementById("file-transfer-panel")!,
      fileTransferList: document.getElementById("file-transfer-list")!,

      // Error
      errorMessage: document.getElementById("error-message")!,
      btnRetry: document.getElementById("btn-retry")! as HTMLButtonElement,

      // Video navigation
      videoNavPrev: document.getElementById("video-nav-prev")! as HTMLButtonElement,
      videoNavNext: document.getElementById("video-nav-next")! as HTMLButtonElement,
      videoPagination: document.getElementById("video-pagination")!,
      videoPageIndicator: document.getElementById("video-page-indicator")!,
    };

    this.setupVideoPagination();
  }

  private setupVideoPagination(): void {
    // Set videos per page based on screen size
    this.updateVideosPerPage();
    window.addEventListener("resize", () => this.updateVideosPerPage());

    // Navigation button handlers
    this.elements.videoNavPrev.addEventListener("click", () => this.goToPrevPage());
    this.elements.videoNavNext.addEventListener("click", () => this.goToNextPage());

    // Touch/swipe handlers for mobile
    const videoContainer = document.querySelector(".video-container");
    if (videoContainer) {
      videoContainer.addEventListener(
        "touchstart",
        (e) => {
          this.touchStartX = (e as TouchEvent).changedTouches[0].screenX;
        },
        { passive: true },
      );

      videoContainer.addEventListener(
        "touchend",
        (e) => {
          this.touchEndX = (e as TouchEvent).changedTouches[0].screenX;
          this.handleSwipe();
        },
        { passive: true },
      );
    }

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") this.goToPrevPage();
      if (e.key === "ArrowRight") this.goToNextPage();
    });
  }

  private updateVideosPerPage(): void {
    const isMobile = window.innerWidth <= 768;
    this.videosPerPage = isMobile ? 4 : 9;
    this.updatePagination();
  }

  private handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.goToNextPage();
      } else {
        this.goToPrevPage();
      }
    }
  }

  private goToPrevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  private goToNextPage(): void {
    const totalPages = Math.ceil(this.allVideoIds.length / this.videosPerPage);
    if (this.currentPage < totalPages - 1) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  private updatePagination(): void {
    const totalVideos = this.allVideoIds.length;
    const totalPages = Math.ceil(totalVideos / this.videosPerPage);

    // Show/hide navigation buttons
    this.elements.videoNavPrev.classList.toggle(
      "hidden",
      this.currentPage === 0 || !!this.pinnedVideoId,
    );
    this.elements.videoNavNext.classList.toggle(
      "hidden",
      this.currentPage >= totalPages - 1 || !!this.pinnedVideoId,
    );
    this.elements.videoPagination.classList.toggle(
      "hidden",
      totalPages <= 1 || !!this.pinnedVideoId,
    );

    // Update page indicator
    this.elements.videoPageIndicator.textContent = `${this.currentPage + 1} / ${totalPages}`;

    // Calculate visible range
    const startIdx = this.currentPage * this.videosPerPage;
    const endIdx = Math.min(startIdx + this.videosPerPage, totalVideos);

    // Update visibility of all remote videos (local is always visible as PiP)
    this.allVideoIds.forEach((id, index) => {
      const isVisible = this.pinnedVideoId
        ? id === this.pinnedVideoId
        : index >= startIdx && index < endIdx;
      const videoElement = this.remoteVideos.get(id);

      if (videoElement) {
        videoElement.classList.toggle("hidden", !isVisible);
      }
    });

    // Update grid layout based on visible count
    const visibleCount = this.pinnedVideoId
      ? 1
      : Math.min(this.videosPerPage, totalVideos - startIdx);
    this.updateVideoGridLayout(visibleCount);
  }

  showScreen(screenName: "landing" | "loading" | "meeting" | "error" | "waiting"): void {
    this.elements.landing.classList.add("hidden");
    this.elements.loading.classList.add("hidden");
    this.elements.meeting.classList.add("hidden");
    this.elements.error.classList.add("hidden");
    this.elements.waiting.classList.add("hidden");

    switch (screenName) {
      case "landing":
        this.elements.landing.classList.remove("hidden");
        break;
      case "loading":
        this.elements.loading.classList.remove("hidden");
        break;
      case "meeting":
        this.elements.meeting.classList.remove("hidden");
        break;
      case "error":
        this.elements.error.classList.remove("hidden");
        break;
      case "waiting":
        this.elements.waiting.classList.remove("hidden");
        break;
    }
  }

  setRoomTitle(roomId: string): void {
    this.elements.roomTitle.textContent = roomId;
  }

  setParticipantCount(count: number): void {
    this.elements.participantCount.textContent = count.toString();
  }

  setLocalStream(stream: MediaStream | null): void {
    this.elements.localVideo.srcObject = stream;
    // Ensure local video is muted and volume is 0 to prevent audio feedback
    this.elements.localVideo.muted = true;
    this.elements.localVideo.volume = 0;

    // Update local video PiP state on initial join
    this.updateLocalVideoPiP();
  }

  setLocalName(_name: string): void {
    // Local name is no longer displayed in the new PiP design
    // This method is kept for backwards compatibility but does nothing
  }

  updateMuteButton(isMuted: boolean): void {
    this.elements.btnMute.classList.toggle("off", isMuted);
    this.elements.localMutedIndicator.classList.toggle("visible", isMuted);

    // Toggle SVG icons
    const muteIcon = this.elements.btnMute.querySelector("#icon-mute") as HTMLElement;
    const unmuteIcon = this.elements.btnMute.querySelector("#icon-unmute") as HTMLElement;
    if (muteIcon && unmuteIcon) {
      muteIcon.style.display = isMuted ? "none" : "block";
      unmuteIcon.style.display = isMuted ? "block" : "none";
    }
  }

  updateVideoButton(isEnabled: boolean): void {
    this.elements.btnVideo.classList.toggle("off", !isEnabled);
    this.elements.localVideoOffIndicator.classList.toggle("visible", !isEnabled);

    // Toggle SVG icons
    const videoOnIcon = this.elements.btnVideo.querySelector("#icon-video-on") as HTMLElement;
    const videoOffIcon = this.elements.btnVideo.querySelector("#icon-video-off") as HTMLElement;
    if (videoOnIcon && videoOffIcon) {
      videoOnIcon.style.display = isEnabled ? "block" : "none";
      videoOffIcon.style.display = isEnabled ? "none" : "block";
    }
  }

  updateIncomingVideoButton(isDisabled: boolean): void {
    this.elements.btnIncomingVideo.classList.toggle("active", isDisabled);
    this.elements.btnIncomingVideo.title = isDisabled
      ? "Enable incoming video"
      : "Disable incoming video";

    const onIcon = this.elements.btnIncomingVideo.querySelector("#icon-incoming-on") as HTMLElement;
    const offIcon = this.elements.btnIncomingVideo.querySelector(
      "#icon-incoming-off",
    ) as HTMLElement;
    if (onIcon && offIcon) {
      onIcon.style.display = isDisabled ? "none" : "block";
      offIcon.style.display = isDisabled ? "block" : "none";
    }

    // Update mobile button text
    const mobileBtn = this.elements.btnMobileIncomingVideo;
    const span = mobileBtn.querySelector("span");
    if (span) span.textContent = isDisabled ? "Enable incoming video" : "Disable incoming video";
    mobileBtn.classList.toggle("active", isDisabled);
  }

  updateScreenButton(isSharing: boolean): void {
    this.elements.btnScreen.classList.toggle("active", isSharing);
    this.elements.btnMobileScreen.classList.toggle("active", isSharing);
    this.elements.btnScreen.title = isSharing ? "Stop sharing screen" : "Share screen";
    this.elements.btnMobileScreen.title = isSharing ? "Stop sharing screen" : "Share screen";

    const mobileLabel = this.elements.btnMobileScreen.querySelector("span");
    if (mobileLabel) mobileLabel.textContent = isSharing ? "Stop sharing" : "Share screen";
  }

  updateHandButton(isRaised: boolean): void {
    this.elements.btnHand.classList.toggle("active", isRaised);
    this.elements.localHandIndicator.classList.toggle("visible", isRaised);
    this.elements.localVideoContainer.classList.toggle("hand-raised", isRaised);
    this.elements.localVideoContainer
      .querySelector(".tile-hand-badge")
      ?.classList.toggle("hidden", !isRaised);
  }

  updateRecordButton(isRecording: boolean): void {
    this.elements.btnRecord.classList.toggle("recording", isRecording);
    this.elements.recordingIndicator.classList.toggle("hidden", !isRecording);

    // Toggle SVG icons
    const recordOnIcon = this.elements.btnRecord.querySelector("#icon-record-on") as HTMLElement;
    const recordOffIcon = this.elements.btnRecord.querySelector("#icon-record-off") as HTMLElement;
    if (recordOnIcon && recordOffIcon) {
      recordOnIcon.style.display = isRecording ? "none" : "block";
      recordOffIcon.style.display = isRecording ? "block" : "none";
    }
  }

  updateLockButton(isLocked: boolean): void {
    this.elements.btnLock.classList.toggle("locked", isLocked);
    this.elements.lockIndicator.classList.toggle("hidden", !isLocked);

    // Toggle SVG icons
    const lockClosedIcon = this.elements.btnLock.querySelector("#icon-lock-closed") as HTMLElement;
    const lockOpenIcon = this.elements.btnLock.querySelector("#icon-lock-open") as HTMLElement;
    if (lockClosedIcon && lockOpenIcon) {
      lockClosedIcon.style.display = isLocked ? "block" : "none";
      lockOpenIcon.style.display = isLocked ? "none" : "block";
    }
  }

  updateModeratorControls(isModerator: boolean): void {
    this.elements.btnRecord.classList.toggle("hidden", !isModerator);
    this.elements.btnLock.classList.toggle("hidden", !isModerator);
    this.elements.btnMobileRecord.classList.toggle("hidden", !isModerator);
    this.elements.btnMobileLock.classList.toggle("hidden", !isModerator);
  }

  updateConnectionQuality(quality: "good" | "fair" | "poor" | "unknown"): void {
    const indicator = this.elements.connectionQuality;
    indicator.className = "connection-quality";
    indicator.classList.add(quality);
    indicator.title = `Connection: ${quality}`;
  }

  updateConnectionStatus(
    status: "connected" | "reconnecting" | "reconnected" | "failed" | "disconnected",
    detail?: string,
  ): void {
    const indicator = this.elements.connectionStatus;
    indicator.className = "status-badge connection-status";
    indicator.classList.add(status);

    if (status === "connected") {
      indicator.classList.add("hidden");
      indicator.textContent = "";
      return;
    }

    indicator.classList.remove("hidden");
    indicator.textContent = detail ?? status;
  }

  addRemoteVideo(peer: PeerConnection): void {
    if (this.remoteVideos.has(peer.participantId)) return;

    const videoItem = createRemoteVideoElement(peer);
    this.elements.videoGrid.appendChild(videoItem);
    this.remoteVideos.set(peer.participantId, videoItem);

    // Add to pagination tracking
    this.allVideoIds.push(peer.participantId);
    this.updatePagination();
    this.updateLocalVideoPiP();
  }

  updateRemoteVideoStream(participantId: string, stream: MediaStream): void {
    const videoItem = this.remoteVideos.get(participantId);
    if (videoItem) {
      const video = videoItem.querySelector("video");
      if (video) {
        video.srcObject = stream;
      }
    }
  }

  updatePeerStatus(
    participantId: string,
    updates: {
      isMuted?: boolean;
      isHandRaised?: boolean;
      isModerator?: boolean;
      isVideoOff?: boolean;
    },
  ): void {
    const videoItem = this.remoteVideos.get(participantId);
    if (!videoItem) return;

    const label = videoItem.querySelector(".video-label");
    if (!label) return;

    if (updates.isMuted !== undefined) {
      const mutedIcon = label.querySelector(".muted-icon");
      if (mutedIcon) {
        mutedIcon.classList.toggle("visible", updates.isMuted);
      }
    }

    if (updates.isHandRaised !== undefined) {
      const handIcon = label.querySelector(".hand-icon");
      if (handIcon) {
        handIcon.classList.toggle("visible", updates.isHandRaised);
      }
      videoItem.classList.toggle("hand-raised", updates.isHandRaised);
      videoItem
        .querySelector(".tile-hand-badge")
        ?.classList.toggle("hidden", !updates.isHandRaised);
    }

    if (updates.isVideoOff !== undefined) {
      const videoOffIcon = label.querySelector(".video-off-icon");
      if (videoOffIcon) {
        videoOffIcon.classList.toggle("visible", updates.isVideoOff);
      }
    }

    if (updates.isModerator !== undefined) {
      const statusIcons = label.querySelector(".status-icons");
      if (statusIcons) {
        const existingMod = statusIcons.querySelector(".moderator-icon");
        if (updates.isModerator && !existingMod) {
          const modIcon = document.createElement("span");
          modIcon.className = "moderator-icon";
          modIcon.innerHTML =
            '<svg class="icon" style="fill: #a855f7;"><use href="#icon-record"/></svg>';
          statusIcons.appendChild(modIcon);
        } else if (!updates.isModerator && existingMod) {
          existingMod.remove();
        }
      }
    }
  }

  removeRemoteVideo(participantId: string): void {
    const videoItem = this.remoteVideos.get(participantId);
    if (videoItem) {
      videoItem.remove();
      this.remoteVideos.delete(participantId);
      if (this.pinnedVideoId === participantId) {
        this.pinnedVideoId = null;
        this.elements.videoGrid.classList.remove("has-pinned");
      }

      // Remove from pagination tracking
      const index = this.allVideoIds.indexOf(participantId);
      if (index > -1) {
        this.allVideoIds.splice(index, 1);
      }

      // Adjust current page if necessary
      const totalPages = Math.ceil(this.allVideoIds.length / this.videosPerPage);
      if (this.currentPage >= totalPages) {
        this.currentPage = Math.max(0, totalPages - 1);
      }

      this.updatePagination();
      this.updateLocalVideoPiP();
    }
  }

  private updateVideoGridLayout(visibleCount?: number): void {
    const count = visibleCount ?? this.remoteVideos.size;
    this.elements.videoGrid.className = "video-grid";
    this.elements.videoGrid.classList.toggle("has-pinned", !!this.pinnedVideoId);

    if (count === 1) {
      this.elements.videoGrid.classList.add("single");
    } else if (count === 2) {
      this.elements.videoGrid.classList.add("pair");
    } else if (count === 3) {
      this.elements.videoGrid.classList.add("triple");
    } else if (count === 4) {
      this.elements.videoGrid.classList.add("quad");
    } else if (count <= 9) {
      this.elements.videoGrid.classList.add("page-9");
    } else {
      this.elements.videoGrid.classList.add("many");
    }
  }

  private updateLocalVideoPiP(): void {
    // No-op: local video is always PiP via CSS (.video-item.local).
    // Kept for call-site compatibility.
  }

  clearRemoteVideos(): void {
    for (const videoItem of this.remoteVideos.values()) {
      videoItem.remove();
    }
    this.remoteVideos.clear();
    this.allVideoIds = [];
    this.currentPage = 0;
    this.pinnedVideoId = null;
    this.updatePagination();
    this.updateLocalVideoPiP();
  }

  togglePinnedVideo(participantId: string): void {
    if (!this.remoteVideos.has(participantId)) return;

    this.pinnedVideoId = this.pinnedVideoId === participantId ? null : participantId;

    for (const [id, item] of this.remoteVideos.entries()) {
      item.classList.toggle("pinned", id === this.pinnedVideoId);
    }

    this.updatePagination();
  }

  toggleReactionPicker(): void {
    const isHidden = this.elements.reactionPicker.classList.toggle("hidden");
    this.elements.btnReactions.classList.toggle("active", !isHidden);
  }

  closeReactionPicker(): void {
    this.elements.reactionPicker.classList.add("hidden");
    this.elements.btnReactions.classList.remove("active");
  }

  showReaction(participantId: string, reaction: string, participantName: string): void {
    const target =
      this.remoteVideos.get(participantId) ??
      (this.elements.localVideoContainer.dataset.participantId === participantId
        ? this.elements.localVideoContainer
        : null);

    if (!target) return;

    const burst = document.createElement("div");
    burst.className = "reaction-burst";
    burst.title = participantName;
    burst.appendChild(this.createReactionNode(reaction));
    target.appendChild(burst);

    target.querySelector(".reaction-badge")?.remove();
    const badge = document.createElement("div");
    badge.className = "reaction-badge";
    badge.appendChild(this.createReactionNode(reaction));
    badge.title = `${participantName}: ${reaction}`;
    target.appendChild(badge);

    setTimeout(() => burst.remove(), 1800);
    setTimeout(() => badge.remove(), 2600);
  }

  private createReactionNode(reaction: string): SVGSVGElement | Text {
    return createReactionIcon(reaction) ?? document.createTextNode(reaction);
  }

  // Chat methods
  toggleChat(): void {
    this.chatVisible = !this.chatVisible;
    this.elements.chatPanel.classList.toggle("hidden", !this.chatVisible);
    this.elements.btnChat.classList.toggle("active", this.chatVisible);
    if (this.chatVisible) this.clearChatUnread();
  }

  closeChat(): void {
    this.chatVisible = false;
    this.elements.chatPanel.classList.add("hidden");
    this.elements.btnChat.classList.remove("active");
  }

  isChatOpen(): boolean {
    return this.chatVisible;
  }

  showChatUnread(): void {
    this.elements.chatUnread.classList.remove("hidden");
    this.elements.chatUnreadMobile.classList.remove("hidden");
  }

  clearChatUnread(): void {
    this.elements.chatUnread.classList.add("hidden");
    this.elements.chatUnreadMobile.classList.add("hidden");
  }

  addChatMessage(message: ChatMessageUI): void {
    const messageEl = createChatMessageElement(message);
    this.elements.chatMessages.appendChild(messageEl);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  clearChatInput(): void {
    this.elements.chatInput.value = "";
  }

  showReplyPreview(message: ChatMessageUI): void {
    this.elements.chatReplyName.textContent = message.participantName;
    this.elements.chatReplyText.textContent = message.text;
    this.elements.chatReplyPreview.classList.remove("hidden");
    this.elements.chatInput.focus();
  }

  clearReplyPreview(): void {
    this.elements.chatReplyName.textContent = "";
    this.elements.chatReplyText.textContent = "";
    this.elements.chatReplyPreview.classList.add("hidden");
  }

  getChatInput(): string {
    return this.elements.chatInput.value.trim();
  }

  // Participants panel
  toggleParticipants(): void {
    this.participantsVisible = !this.participantsVisible;
    this.elements.participantsPanel.classList.toggle("hidden", !this.participantsVisible);
    this.elements.btnParticipants.classList.toggle("active", this.participantsVisible);
  }

  closeParticipants(): void {
    this.participantsVisible = false;
    this.elements.participantsPanel.classList.add("hidden");
    this.elements.btnParticipants.classList.remove("active");
  }

  // Mobile menu
  openMobileMenu(): void {
    this.elements.mobileMenu.classList.remove("hidden");

    // Create backdrop as sibling right before the menu (same stacking context)
    if (!document.querySelector(".mobile-backdrop")) {
      const backdrop = document.createElement("div");
      backdrop.className = "mobile-backdrop";
      backdrop.addEventListener("click", () => this.closeMobileMenu());
      backdrop.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
      this.elements.mobileMenu.parentElement!.insertBefore(backdrop, this.elements.mobileMenu);
    }
  }

  closeMobileMenu(): void {
    this.elements.mobileMenu.classList.add("hidden");

    const backdrop = document.querySelector(".mobile-backdrop");
    if (backdrop) {
      backdrop.remove();
    }
  }

  updateParticipantsList(participants: ParticipantListItem[], isModerator: boolean): void {
    this.elements.participantsList.innerHTML = "";

    for (const participant of participants) {
      this.elements.participantsList.appendChild(
        createParticipantListItem(participant, isModerator),
      );
    }
  }

  // Waiting room
  updateWaitingRoom(
    waitingList: Array<{ id: string; name: string }>,
    onAdmit: (id: string) => void,
    onReject: (id: string) => void,
  ): void {
    this.elements.waitingRoomList.innerHTML = "";

    for (const person of waitingList) {
      this.elements.waitingRoomList.appendChild(createWaitingRoomItem(person, onAdmit, onReject));
    }

    this.elements.btnAdmitAll.classList.toggle("hidden", waitingList.length === 0);
    this.elements.waitingRoomSection.classList.toggle("hidden", waitingList.length === 0);
  }

  showParticipants(): void {
    this.participantsVisible = true;
    this.elements.participantsPanel.classList.remove("hidden");
  }

  // File transfer UI
  addFileTransfer(transfer: FileTransfer, actions?: FileTransferActions): void {
    const existing = this.elements.fileTransferList.querySelector(
      `[data-transfer-id="${escapeAttr(transfer.id)}"]`,
    );
    if (existing) return;

    const item = createFileTransferItem(transfer, actions);
    this.elements.fileTransferList.appendChild(item);
    this.elements.fileTransferPanel.classList.remove("hidden");
  }

  updateFileTransferProgress(transferId: string, progress: number): void {
    const item = this.elements.fileTransferList.querySelector(`[data-transfer-id="${transferId}"]`);
    if (item) {
      const fill = item.querySelector(".progress-fill") as HTMLElement;
      if (fill) {
        // Remove all progress-width classes
        fill.classList.remove(
          "progress-width-0",
          "progress-width-25",
          "progress-width-50",
          "progress-width-75",
          "progress-width-100",
        );

        // Add appropriate class based on progress
        if (progress >= 100) {
          fill.classList.add("progress-width-100");
        } else if (progress >= 75) {
          fill.classList.add("progress-width-75");
        } else if (progress >= 50) {
          fill.classList.add("progress-width-50");
        } else if (progress >= 25) {
          fill.classList.add("progress-width-25");
        } else {
          fill.classList.add("progress-width-0");
        }
      }
    }
  }

  completeFileTransfer(transferId: string, onDownload?: () => void): void {
    const item = this.elements.fileTransferList.querySelector(`[data-transfer-id="${transferId}"]`);
    if (item) {
      const actions = item.querySelector(".file-actions");
      if (actions) {
        actions.innerHTML = '<button class="btn-download">Download</button>';
        if (onDownload) {
          actions.querySelector(".btn-download")?.addEventListener("click", onDownload);
        }
      }
    }
  }

  removeFileTransfer(transferId: string): void {
    const item = this.elements.fileTransferList.querySelector(`[data-transfer-id="${transferId}"]`);
    if (item) {
      item.remove();
    }

    if (this.elements.fileTransferList.children.length === 0) {
      this.elements.fileTransferPanel.classList.add("hidden");
    }
  }

  // Utility methods
  showError(message: string): void {
    this.elements.errorMessage.textContent = message;
    this.showScreen("error");
  }

  getJoinFormData(): {
    name: string;
    roomId: string;
    password?: string;
    maxParticipants?: number;
    title?: string;
    scheduledStart?: number;
    scheduledDurationMinutes?: number;
    enableVideo: boolean;
    enableAudio: boolean;
  } {
    const password =
      this.elements.joinPasswordInput.value.trim() || this.elements.roomPasswordInput.value.trim();
    const maxParticipantsStr = this.elements.maxParticipantsInput.value.trim();
    const maxParticipants = maxParticipantsStr
      ? Number.parseInt(maxParticipantsStr, 10)
      : undefined;
    const title = this.elements.meetingTitleInput.value.trim();
    const scheduledStartStr = this.elements.scheduledStartInput.value.trim();
    const scheduledStart = scheduledStartStr ? new Date(scheduledStartStr).getTime() : undefined;
    const scheduledDurationStr = this.elements.scheduledDurationInput.value.trim();
    const scheduledDurationMinutes = scheduledDurationStr
      ? Number.parseInt(scheduledDurationStr, 10)
      : undefined;

    return {
      name: this.elements.nameInput.value.trim(),
      roomId: this.elements.roomInput.value.trim(),
      password: password || undefined,
      maxParticipants,
      title: title || undefined,
      scheduledStart: Number.isFinite(scheduledStart) ? scheduledStart : undefined,
      scheduledDurationMinutes,
      enableVideo: true,
      enableAudio: true,
    };
  }

  clearForm(): void {
    this.elements.joinForm.reset();
  }

  setJoinFormDisabled(disabled: boolean): void {
    const inputs = this.elements.joinForm.querySelectorAll("input, button");
    for (const input of inputs) {
      (input as HTMLInputElement | HTMLButtonElement).disabled = disabled;
    }
  }
}
