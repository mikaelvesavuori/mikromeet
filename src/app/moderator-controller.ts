import type { Notifier } from "./notifications.js";
import type { SignalingClient } from "./signaling.js";
import type { ModeratorAction, WaitingRoomMessage } from "./types.js";
import type { UIManager } from "./ui.js";

const MODERATOR_ACTIONS: readonly ModeratorAction[] = ["mute", "unmute", "kick", "make-moderator"];

interface ModeratorControllerDependencies {
  ui: UIManager;
  notifier: Notifier;
  getSignaling: () => SignalingClient | null;
  getRoomId: () => string;
  getParticipantId: () => string | null;
  isModerator: () => boolean;
}

export class ModeratorController {
  private waitingList: Array<{ id: string; name: string }> = [];

  constructor(private dependencies: ModeratorControllerDependencies) {}

  handleAction(action: string, targetId: string): void {
    const signaling = this.dependencies.getSignaling();
    if (!this.dependencies.isModerator() || !signaling) return;
    if (!this.isModeratorAction(action)) return;

    signaling.sendModeratorAction(
      targetId,
      this.dependencies.getRoomId(),
      this.dependencies.getParticipantId() ?? "",
      action,
    );
  }

  handleWaitingRoom(message: WaitingRoomMessage): void {
    if (!this.dependencies.isModerator()) return;

    if (!this.waitingList.some((waiting) => waiting.id === message.participantId)) {
      this.waitingList.push({ id: message.participantId, name: message.name });
    }

    this.dependencies.ui.showParticipants();
    this.renderWaitingRoom();
  }

  reset(): void {
    this.waitingList = [];
    this.renderWaitingRoom();
  }

  private renderWaitingRoom(): void {
    const ui = this.dependencies.ui;
    ui.elements.btnAdmitAll.onclick = () => {
      for (const waiting of this.waitingList) {
        this.dependencies
          .getSignaling()
          ?.admitUser(
            waiting.id,
            this.dependencies.getRoomId(),
            this.dependencies.getParticipantId() ?? "",
          );
      }
      this.waitingList = [];
      this.renderWaitingRoom();
    };

    ui.updateWaitingRoom(
      this.waitingList,
      (id) => {
        this.dependencies
          .getSignaling()
          ?.admitUser(
            id,
            this.dependencies.getRoomId(),
            this.dependencies.getParticipantId() ?? "",
          );
        this.waitingList = this.waitingList.filter((waiting) => waiting.id !== id);
        this.renderWaitingRoom();
      },
      (id) => {
        this.dependencies
          .getSignaling()
          ?.rejectUser(
            id,
            this.dependencies.getRoomId(),
            this.dependencies.getParticipantId() ?? "",
            "Rejected by moderator",
          );
        this.waitingList = this.waitingList.filter((waiting) => waiting.id !== id);
        this.renderWaitingRoom();
      },
    );
  }

  private isModeratorAction(action: string): action is ModeratorAction {
    return MODERATOR_ACTIONS.includes(action as ModeratorAction);
  }
}
