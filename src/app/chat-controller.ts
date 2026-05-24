import type { SignalingClient } from "./signaling.js";
import type { ChatMessage, ChatMessageUI } from "./types.js";
import type { UIManager } from "./ui.js";

interface ChatControllerDependencies {
  ui: UIManager;
  getSignaling: () => SignalingClient | null;
  getRoomId: () => string;
  getParticipantId: () => string | null;
  getPeerName: (participantId: string) => string | undefined;
}

export class ChatController {
  private messages: ChatMessageUI[] = [];
  private replyTarget: ChatMessageUI | null = null;

  constructor(private dependencies: ChatControllerDependencies) {}

  handleMessage(message: ChatMessage): void {
    const participantId = this.dependencies.getParticipantId();
    const isMe = message.participantId === participantId;
    const reply = message.replyTo
      ? this.messages.find((chatMessage) => chatMessage.id === message.replyTo)
      : undefined;

    const chatMessage: ChatMessageUI = {
      id: `${message.timestamp}-${message.participantId}`,
      participantId: message.participantId,
      participantName: isMe
        ? "You"
        : this.dependencies.getPeerName(message.participantId) || "Unknown",
      text: message.text,
      timestamp: message.timestamp,
      isMe,
      replyTo: message.replyTo,
      replyPreview: reply ? `${reply.participantName}: ${reply.text}` : undefined,
    };

    this.messages.push(chatMessage);
    this.dependencies.ui.addChatMessage(chatMessage);

    if (!isMe && !this.dependencies.ui.isChatOpen()) {
      this.dependencies.ui.showChatUnread();
    }
  }

  sendMessage(): void {
    const ui = this.dependencies.ui;
    const text = ui.getChatInput();
    const signaling = this.dependencies.getSignaling();
    if (!text || !signaling) return;

    signaling.sendChat(
      this.dependencies.getRoomId(),
      this.dependencies.getParticipantId() ?? "",
      text,
      this.replyTarget?.id,
    );
    ui.clearChatInput();
    this.clearReplyTarget();
  }

  setReplyTarget(messageId: string): void {
    const message = this.messages.find((chatMessage) => chatMessage.id === messageId);
    if (!message) return;

    this.replyTarget = message;
    this.dependencies.ui.showReplyPreview(message);
  }

  clearReplyTarget(): void {
    this.replyTarget = null;
    this.dependencies.ui.clearReplyPreview();
  }

  reset(): void {
    this.messages = [];
    this.clearReplyTarget();
  }
}
