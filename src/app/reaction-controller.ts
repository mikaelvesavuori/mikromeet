import type { SignalingClient } from "./signaling.js";
import type { ReactionMessage } from "./types.js";
import type { UIManager } from "./ui.js";

interface ReactionControllerOptions {
  ui: UIManager;
  getSignaling: () => SignalingClient | null;
  getRoomId: () => string;
  getParticipantId: () => string | null;
  getParticipantName: () => string;
  getPeerName: (participantId: string) => string | undefined;
}

export class ReactionController {
  constructor(private options: ReactionControllerOptions) {}

  sendReaction(reaction: string): void {
    const signaling = this.options.getSignaling();
    const roomId = this.options.getRoomId();
    const participantId = this.options.getParticipantId();
    if (!signaling || !roomId || !participantId) return;

    signaling.sendReaction(roomId, participantId, reaction);
    this.options.ui.showReaction(participantId, reaction, this.options.getParticipantName());
  }

  handleReaction(message: ReactionMessage): void {
    const participantName =
      message.participantId === this.options.getParticipantId()
        ? this.options.getParticipantName()
        : this.options.getPeerName(message.participantId) || "Participant";

    this.options.ui.showReaction(message.participantId, message.reaction, participantName);
  }
}
