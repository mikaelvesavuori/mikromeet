import type {
  AdmitUserMessage,
  AnswerMessage,
  ChatMessage,
  FileAnswerMessage,
  FileChunkMessage,
  FileOfferMessage,
  IceCandidateMessage,
  JoinMessage,
  LeaveMessage,
  LowerHandMessage,
  ModeratorAction,
  ModeratorActionMessage,
  OfferMessage,
  QualityChangeMessage,
  RaiseHandMessage,
  ReactionMessage,
  RecordingStartedMessage,
  RecordingStoppedMessage,
  RejectUserMessage,
  SignalingMessage,
} from "./types.js";

export type MessageHandler = (message: SignalingMessage) => void;

export type ConnectionStatus =
  | "connected"
  | "reconnecting"
  | "reconnected"
  | "failed"
  | "disconnected";

export interface ConnectionStatusEvent {
  status: ConnectionStatus;
  attempt?: number;
  maxAttempts?: number;
  delay?: number;
}

export type ConnectionStatusHandler = (event: ConnectionStatusEvent) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<ConnectionStatusHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: SignalingMessage[] = [];
  private isReconnecting = false;
  private lastJoinMessage: JoinMessage | null = null;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.shouldReconnect = true;
        this.ws = new WebSocket(this.url);
        let settled = false;

        this.ws.onopen = () => {
          const wasReconnecting = this.isReconnecting;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.emitStatus({ status: wasReconnecting ? "reconnected" : "connected" });
          this.flushMessageQueue();
          settled = true;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as SignalingMessage;
            for (const handler of this.messageHandlers) {
              handler(message);
            }
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        };

        this.ws.onclose = () => {
          if (this.shouldReconnect) {
            this.attemptReconnect();
          } else {
            this.emitStatus({ status: "disconnected" });
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          if (!settled) {
            settled = true;
            reject(error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.isReconnecting = false;
      this.emitStatus({ status: "failed", maxAttempts: this.maxReconnectAttempts });
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    this.emitStatus({
      status: "reconnecting",
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect) return;
      this.connect().catch(() => {
        if (this.shouldReconnect) {
          this.attemptReconnect();
        }
      });
    }, delay);
  }

  private flushMessageQueue(): void {
    // Re-join the room first if we have a previous join message
    if (this.lastJoinMessage) {
      this.send({ ...this.lastJoinMessage, timestamp: Date.now() });
    }

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.isReconnecting = false;
    this.lastJoinMessage = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStatus(handler: ConnectionStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private emitStatus(event: ConnectionStatusEvent): void {
    for (const handler of this.statusHandlers) {
      handler(event);
    }
  }

  send(message: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      if (this.messageQueue.length > 100) {
        // Prevent unbounded growth
        this.messageQueue.shift();
      }
    }
  }

  join(
    roomId: string,
    name: string,
    password?: string,
    isHost = false,
    creatorToken?: string,
  ): void {
    const message: JoinMessage = {
      type: "join",
      roomId,
      participantId: "",
      name,
      password,
      isHost,
      creatorToken,
      timestamp: Date.now(),
    };
    this.lastJoinMessage = message;
    this.send(message);
  }

  leave(roomId: string, participantId: string): void {
    const message: LeaveMessage = {
      type: "leave",
      roomId,
      participantId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendOffer(targetId: string, roomId: string, participantId: string, sdp: string): void {
    const message: OfferMessage = {
      type: "offer",
      roomId,
      participantId,
      targetId,
      sdp,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendAnswer(targetId: string, roomId: string, participantId: string, sdp: string): void {
    const message: AnswerMessage = {
      type: "answer",
      roomId,
      participantId,
      targetId,
      sdp,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendIceCandidate(
    targetId: string,
    roomId: string,
    participantId: string,
    candidate: RTCIceCandidateInit,
  ): void {
    const message: IceCandidateMessage = {
      type: "ice-candidate",
      roomId,
      participantId,
      targetId,
      candidate,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Chat methods
  sendChat(roomId: string, participantId: string, text: string, replyTo?: string): void {
    const message: ChatMessage = {
      type: "chat",
      roomId,
      participantId,
      text,
      replyTo,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // File transfer methods
  sendFileOffer(
    targetId: string,
    roomId: string,
    participantId: string,
    transferId: string,
    fileName: string,
    fileSize: number,
    fileType: string,
  ): void {
    const message: FileOfferMessage = {
      type: "file-offer",
      roomId,
      participantId,
      targetId,
      transferId,
      fileName,
      fileSize,
      fileType,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendFileAnswer(
    targetId: string,
    roomId: string,
    participantId: string,
    transferId: string,
    accepted: boolean,
  ): void {
    const message: FileAnswerMessage = {
      type: "file-answer",
      roomId,
      participantId,
      targetId,
      transferId,
      accepted,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendFileChunk(
    targetId: string,
    roomId: string,
    participantId: string,
    transferId: string,
    chunk: string,
    index: number,
    total: number,
  ): void {
    const message: FileChunkMessage = {
      type: "file-chunk",
      roomId,
      participantId,
      targetId,
      transferId,
      chunk,
      index,
      total,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Moderator actions
  sendModeratorAction(
    targetId: string,
    roomId: string,
    participantId: string,
    action: ModeratorAction,
  ): void {
    const message: ModeratorActionMessage = {
      type: "moderator-action",
      roomId,
      participantId,
      targetId,
      action,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Room management
  lockRoom(roomId: string, participantId: string): void {
    this.send({
      type: "room-locked",
      roomId,
      participantId,
      lockedBy: participantId,
      timestamp: Date.now(),
    });
  }

  unlockRoom(roomId: string, participantId: string): void {
    this.send({
      type: "room-unlocked",
      roomId,
      participantId,
      unlockedBy: participantId,
      timestamp: Date.now(),
    });
  }

  // Waiting room
  admitUser(targetId: string, roomId: string, participantId: string): void {
    const message: AdmitUserMessage = {
      type: "admit-user",
      roomId,
      participantId,
      targetId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  rejectUser(targetId: string, roomId: string, participantId: string, reason: string): void {
    const message: RejectUserMessage = {
      type: "reject-user",
      roomId,
      participantId,
      targetId,
      reason,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Hand raising
  raiseHand(roomId: string, participantId: string): void {
    const message: RaiseHandMessage = {
      type: "raise-hand",
      roomId,
      participantId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  lowerHand(roomId: string, participantId: string): void {
    const message: LowerHandMessage = {
      type: "lower-hand",
      roomId,
      participantId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendReaction(roomId: string, participantId: string, reaction: string): void {
    const message: ReactionMessage = {
      type: "reaction",
      roomId,
      participantId,
      reaction,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Recording status
  recordingStarted(roomId: string, participantId: string): void {
    const message: RecordingStartedMessage = {
      type: "recording-started",
      roomId,
      participantId,
      startedBy: participantId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  recordingStopped(roomId: string, participantId: string): void {
    const message: RecordingStoppedMessage = {
      type: "recording-stopped",
      roomId,
      participantId,
      stoppedBy: participantId,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Quality control
  changeQuality(
    targetId: string,
    roomId: string,
    participantId: string,
    quality: "high" | "medium" | "low",
  ): void {
    const message: QualityChangeMessage = {
      type: "quality-change",
      roomId,
      participantId,
      targetId,
      quality,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  // Update participant state
  updateParticipantState(
    roomId: string,
    participantId: string,
    updates: {
      isMuted?: boolean;
      isVideoOff?: boolean;
      isHandRaised?: boolean;
    },
  ): void {
    this.send({
      type: "participant-updated",
      roomId,
      participantId,
      ...updates,
      timestamp: Date.now(),
    });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get reconnectCount(): number {
    return this.reconnectAttempts;
  }
}
