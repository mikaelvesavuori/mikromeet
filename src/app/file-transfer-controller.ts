import { FileTransferManager } from "./file-transfer.js";
import type { Notifier } from "./notifications.js";
import type { PeerManager } from "./peer-manager.js";
import type { SignalingClient } from "./signaling.js";
import type { FileAnswerMessage, FileChunkMessage, FileOfferMessage } from "./types.js";
import type { UIManager } from "./ui.js";

export class FileTransferController {
  private manager: FileTransferManager | null = null;
  private unsubscribeFromEvents: (() => void) | null = null;

  constructor(
    private ui: UIManager,
    private notifier: Notifier,
    private getPeerManager: () => PeerManager | null,
  ) {}

  initialize(signaling: SignalingClient, roomId: string, participantId: string): void {
    this.reset();
    this.manager = new FileTransferManager(signaling, roomId, participantId);
    this.unsubscribeFromEvents = this.manager.onEvent((event) => {
      switch (event.type) {
        case "file-offer-received":
          if (event.transfer) {
            this.ui.addFileTransfer(event.transfer, {
              onAccept: () => {
                this.manager?.acceptFile(event.transferId);
              },
              onReject: () => {
                this.manager?.rejectFile(event.transferId);
              },
            });
          }
          break;
        case "transfer-started":
          if (event.transfer) {
            this.ui.addFileTransfer(event.transfer, {
              onCancel: () => {
                this.manager?.cancelTransfer(event.transferId);
              },
            });
          }
          break;
        case "transfer-progress":
          if (event.progress !== undefined) {
            this.ui.updateFileTransferProgress(event.transferId, event.progress);
          }
          break;
        case "transfer-completed":
          this.ui.completeFileTransfer(event.transferId, () => {
            this.manager?.downloadFile(event.transferId);
          });
          break;
        case "transfer-cancelled":
        case "transfer-error":
          this.ui.removeFileTransfer(event.transferId);
          break;
      }
    });
  }

  setParticipantId(participantId: string): void {
    this.manager?.setParticipantId(participantId);
  }

  async sendSelectedFiles(): Promise<void> {
    const files = Array.from(this.ui.elements.chatFileInput.files ?? []);
    this.ui.elements.chatFileInput.value = "";
    const peerManager = this.getPeerManager();
    if (files.length === 0 || !this.manager || !peerManager) return;

    const peers = peerManager.getAllPeers();
    if (peers.length === 0) {
      this.notifier.info("No other participants to send files to.");
      return;
    }

    for (const file of files) {
      for (const peer of peers) {
        await this.manager.sendFile(peer.participantId, file);
      }
    }
  }

  handleOffer(message: FileOfferMessage, senderName: string): void {
    this.manager?.handleFileOffer(
      message.transferId,
      message.participantId,
      senderName,
      message.fileName,
      message.fileSize,
      message.fileType,
    );
  }

  handleAnswer(message: FileAnswerMessage): void {
    this.manager?.handleFileAnswer(message.transferId, message.accepted);
  }

  handleChunk(message: FileChunkMessage): void {
    this.manager?.handleFileChunk(message.transferId, message.chunk, message.index, message.total);
  }

  reset(): void {
    this.unsubscribeFromEvents?.();
    this.unsubscribeFromEvents = null;
    this.manager = null;
  }
}
