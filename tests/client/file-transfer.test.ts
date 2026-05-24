import { describe, expect, it, vi } from "vitest";

import { FileTransferManager } from "../../src/app/file-transfer.js";
import type { SignalingClient } from "../../src/app/signaling.js";

const CHUNK_SIZE = 16384;

function createSignalingMock(): SignalingClient {
  return {
    sendFileOffer: vi.fn(),
    sendFileAnswer: vi.fn(),
    sendFileChunk: vi.fn(),
  } as unknown as SignalingClient;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

describe("FileTransferManager", () => {
  it("uses the confirmed participant id when offering files", async () => {
    const signaling = createSignalingMock();
    const manager = new FileTransferManager(signaling, "ROOM42", "");
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    manager.setParticipantId("sender-1");

    const transferId = await manager.sendFile("peer-1", file);

    expect(transferId.startsWith("sender-1-peer-1-")).toBe(true);
    expect(signaling.sendFileOffer).toHaveBeenCalledWith(
      "peer-1",
      "ROOM42",
      "sender-1",
      transferId,
      "hello.txt",
      5,
      "text/plain",
    );
  });

  it("assembles multi-chunk base64 transfers without corrupting bytes", async () => {
    const signaling = createSignalingMock();
    const manager = new FileTransferManager(signaling, "ROOM42", "receiver-1");
    const bytes = new Uint8Array(CHUNK_SIZE * 2 + 17);
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 251;
    }

    const completed = new Promise<Blob>((resolve) => {
      manager.onEvent((event) => {
        if (event.type === "transfer-completed" && event.transfer?.blob) {
          resolve(event.transfer.blob);
        }
      });
    });

    manager.handleFileOffer(
      "transfer-1",
      "sender-1",
      "Sender",
      "payload.bin",
      bytes.length,
      "application/octet-stream",
    );

    const total = Math.ceil(bytes.length / CHUNK_SIZE);
    for (let index = 0; index < total; index++) {
      const start = index * CHUNK_SIZE;
      const chunk = bytes.slice(start, Math.min(start + CHUNK_SIZE, bytes.length));
      manager.handleFileChunk("transfer-1", bytesToBase64(chunk), index, total);
    }

    const blob = await completed;
    const actual = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(actual)).toEqual(Array.from(bytes));
  });
});
