import type { SignalingClient } from "./signaling.js";
import type { FileTransfer } from "./types.js";

export type FileTransferEventType =
  | "transfer-started"
  | "transfer-progress"
  | "transfer-completed"
  | "transfer-cancelled"
  | "transfer-error"
  | "file-offer-received";

export interface FileTransferEvent {
  type: FileTransferEventType;
  transferId: string;
  transfer?: FileTransfer;
  progress?: number;
  error?: Error;
}

export type FileTransferEventHandler = (event: FileTransferEvent) => void;

const CHUNK_SIZE = 16384; // 16KB chunks

export class FileTransferManager {
  private transfers: Map<string, FileTransfer> = new Map();
  private pendingFiles: Map<string, File> = new Map();
  private eventHandlers: Set<FileTransferEventHandler> = new Set();

  constructor(
    private signaling: SignalingClient,
    private roomId: string,
    private participantId: string,
  ) {}

  setParticipantId(participantId: string): void {
    this.participantId = participantId;
  }

  onEvent(handler: FileTransferEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private emit(event: FileTransferEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  // Send a file to another participant
  async sendFile(targetId: string, file: File): Promise<string> {
    const transferId = `${this.participantId}-${targetId}-${this.createTransferSuffix()}`;

    const transfer: FileTransfer = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      senderId: this.participantId,
      senderName: "You",
      targetId,
      chunks: [],
      receivedChunks: 0,
      totalChunks: this.getTotalChunks(file.size),
    };

    this.transfers.set(transferId, transfer);
    this.pendingFiles.set(transferId, file);

    // Send file offer via signaling
    this.signaling.sendFileOffer(
      targetId,
      this.roomId,
      this.participantId,
      transferId,
      file.name,
      file.size,
      file.type,
    );

    this.emit({
      type: "transfer-started",
      transferId,
      transfer,
    });

    return transferId;
  }

  // Handle incoming file offer
  handleFileOffer(
    transferId: string,
    senderId: string,
    senderName: string,
    fileName: string,
    fileSize: number,
    fileType: string,
  ): void {
    const transfer: FileTransfer = {
      id: transferId,
      fileName,
      fileSize,
      fileType,
      senderId,
      senderName,
      targetId: this.participantId,
      chunks: [],
      receivedChunks: 0,
      totalChunks: this.getTotalChunks(fileSize),
    };

    this.transfers.set(transferId, transfer);

    this.emit({
      type: "file-offer-received",
      transferId,
      transfer,
    });
  }

  // Accept file transfer
  acceptFile(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    // Accept via signaling
    this.signaling.sendFileAnswer(
      transfer.senderId,
      this.roomId,
      this.participantId,
      transferId,
      true,
    );

    this.emit({
      type: "transfer-started",
      transferId,
      transfer,
    });
  }

  // Reject file transfer
  rejectFile(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    this.signaling.sendFileAnswer(
      transfer.senderId,
      this.roomId,
      this.participantId,
      transferId,
      false,
    );

    this.transfers.delete(transferId);

    this.emit({
      type: "transfer-cancelled",
      transferId,
    });
  }

  handleFileAnswer(transferId: string, accepted: boolean): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    if (!accepted) {
      this.pendingFiles.delete(transferId);
      this.removeTransfer(transferId);
      this.emit({
        type: "transfer-cancelled",
        transferId,
      });
      return;
    }

    const file = this.pendingFiles.get(transferId);
    if (!file) return;

    void this.sendFileChunks(transferId, file).finally(() => {
      this.pendingFiles.delete(transferId);
    });
  }

  // Actually send file chunks via signaling
  async sendFileChunks(transferId: string, file: File): Promise<void> {
    const transfer = this.transfers.get(transferId);

    if (!transfer?.targetId) return;

    try {
      const totalChunks = transfer.totalChunks;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const arrayBuffer = await chunk.arrayBuffer();
        const base64Chunk = this.arrayBufferToBase64(arrayBuffer);

        this.signaling.sendFileChunk(
          transfer.targetId,
          this.roomId,
          this.participantId,
          transferId,
          base64Chunk,
          i,
          totalChunks,
        );

        // Update progress
        const progress = ((i + 1) / totalChunks) * 100;
        this.emit({
          type: "transfer-progress",
          transferId,
          progress,
        });

        // Small delay to prevent overwhelming the connection
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Complete the transfer
      transfer.blob = file;
      this.emit({
        type: "transfer-completed",
        transferId,
        transfer,
      });
    } catch (error) {
      console.error("Failed to send file chunks:", error);
      this.emit({
        type: "transfer-error",
        transferId,
        error: error instanceof Error ? error : new Error("Transfer failed"),
      });
    }
  }

  // Handle incoming file chunk
  handleFileChunk(transferId: string, chunk: string, index: number, total: number): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    if (transfer.chunks[index] === undefined) {
      transfer.receivedChunks++;
    }
    transfer.chunks[index] = chunk;

    const progress = (transfer.receivedChunks / total) * 100;
    this.emit({
      type: "transfer-progress",
      transferId,
      progress,
    });

    // Check if all chunks received
    if (transfer.receivedChunks === total && this.hasAllChunks(transfer, total)) {
      this.assembleFile(transferId);
    }
  }

  private assembleFile(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    try {
      const parts = transfer.chunks.map((chunk) => this.base64ToArrayBuffer(chunk));
      transfer.blob = new Blob(parts, { type: transfer.fileType });

      this.emit({
        type: "transfer-completed",
        transferId,
        transfer,
      });
    } catch (error) {
      console.error("Failed to assemble file:", error);
      this.emit({
        type: "transfer-error",
        transferId,
        error: error instanceof Error ? error : new Error("Assembly failed"),
      });
    }
  }

  private hasAllChunks(transfer: FileTransfer, total: number): boolean {
    for (let index = 0; index < total; index++) {
      if (transfer.chunks[index] === undefined) return false;
    }
    return true;
  }

  private getTotalChunks(size: number): number {
    return Math.max(1, Math.ceil(size / CHUNK_SIZE));
  }

  private createTransferSuffix(): string {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  getTransfer(transferId: string): FileTransfer | undefined {
    return this.transfers.get(transferId);
  }

  getAllTransfers(): FileTransfer[] {
    return Array.from(this.transfers.values());
  }

  removeTransfer(transferId: string): void {
    this.pendingFiles.delete(transferId);
    this.transfers.delete(transferId);
  }

  cancelTransfer(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      const targetId =
        transfer.senderId === this.participantId ? transfer.targetId : transfer.senderId;
      if (targetId) {
        this.signaling.sendFileAnswer(targetId, this.roomId, this.participantId, transferId, false);
      }
    }
    this.removeTransfer(transferId);

    this.emit({
      type: "transfer-cancelled",
      transferId,
    });
  }

  downloadFile(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer?.blob) return;

    const url = URL.createObjectURL(transfer.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = transfer.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
