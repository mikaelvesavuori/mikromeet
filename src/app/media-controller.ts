import type { Notifier } from "./notifications.js";
import type { PeerManager } from "./peer-manager.js";
import type { SignalingClient } from "./signaling.js";
import type { RecordingStartedMessage, RecordingStoppedMessage } from "./types.js";
import type { UIManager } from "./ui.js";

interface MediaControllerDependencies {
  ui: UIManager;
  notifier: Notifier;
  getLocalStream: () => MediaStream | null;
  getPeerManager: () => PeerManager | null;
  getSignaling: () => SignalingClient | null;
  getRoomId: () => string;
  getParticipantId: () => string | null;
  isModerator: () => boolean;
  isVideoEnabled: () => boolean;
}

export class MediaController {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private screenStream: MediaStream | null = null;
  private isRecording = false;
  private isLocalRecording = false;
  private isScreenSharing = false;

  constructor(private dependencies: MediaControllerDependencies) {}

  async toggleRecording(): Promise<void> {
    if (!this.dependencies.isModerator()) {
      this.dependencies.notifier.error("Only moderators can start/stop recording");
      return;
    }

    if (this.isRecording) {
      if (this.isLocalRecording) {
        this.stopRecording();
      } else {
        this.dependencies.notifier.info("Recording is already in progress");
      }
    } else {
      await this.startRecording();
    }
  }

  handleRecordingStarted(_message: RecordingStartedMessage): void {
    this.isRecording = true;
    this.dependencies.ui.updateRecordButton(true);
  }

  handleRecordingStopped(_message: RecordingStoppedMessage): void {
    this.isRecording = false;
    this.isLocalRecording = false;
    this.dependencies.ui.updateRecordButton(false);
  }

  async shareScreen(): Promise<void> {
    if (this.isScreenSharing) {
      await this.stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      this.screenStream = screenStream;
      this.isScreenSharing = true;
      this.dependencies.ui.updateScreenButton(true);
      this.dependencies.ui.setLocalStream(screenStream);

      const localStream = this.dependencies.getLocalStream();
      const peerManager = this.dependencies.getPeerManager();
      if (localStream && peerManager) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const senders = peerManager
          .getAllPeers()
          .flatMap((peer) => peer.connection.getSenders())
          .filter((sender) => sender.track?.kind === "video");

        for (const sender of senders) {
          await sender.replaceTrack(videoTrack);
        }

        videoTrack.onended = () => {
          void this.stopScreenShare();
        };
      }
    } catch (error) {
      console.error("Failed to share screen:", error);
    }
  }

  cleanup(): void {
    if (this.isLocalRecording) {
      this.stopRecording();
    }

    this.stopScreenStream();
    this.isScreenSharing = false;
    this.dependencies.ui.updateScreenButton(false);
    this.isRecording = false;
    this.isLocalRecording = false;
  }

  private async startRecording(): Promise<void> {
    const localStream = this.dependencies.getLocalStream();
    if (!localStream) return;

    try {
      const combinedStream = new MediaStream();

      const localRecordingStream = this.screenStream ?? localStream;
      localRecordingStream.getTracks().forEach((track) => {
        combinedStream.addTrack(track);
      });

      this.dependencies
        .getPeerManager()
        ?.getAllPeers()
        .forEach((peer) => {
          if (peer.stream) {
            peer.stream.getTracks().forEach((track) => {
              combinedStream.addTrack(track);
            });
          }
        });

      this.mediaRecorder = new MediaRecorder(combinedStream);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `MikroMeet-recording-${new Date().toISOString()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.isLocalRecording = true;
      this.dependencies.ui.updateRecordButton(true);
      this.dependencies
        .getSignaling()
        ?.recordingStarted(
          this.dependencies.getRoomId(),
          this.dependencies.getParticipantId() ?? "",
        );
    } catch (error) {
      console.error("Failed to start recording:", error);
      this.dependencies.notifier.error("Failed to start recording");
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.isLocalRecording = false;
    this.dependencies.ui.updateRecordButton(false);
    this.dependencies
      .getSignaling()
      ?.recordingStopped(this.dependencies.getRoomId(), this.dependencies.getParticipantId() ?? "");
  }

  private async stopScreenShare(): Promise<void> {
    try {
      this.stopScreenStream();
      this.isScreenSharing = false;
      this.dependencies.ui.updateScreenButton(false);

      const localStream = this.dependencies.getLocalStream();
      if (!localStream) return;

      const newStream = this.dependencies.isVideoEnabled()
        ? await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: "user",
            },
            audio: false,
          })
        : null;

      const videoTrack = newStream?.getVideoTracks()[0] ?? null;
      const peerManager = this.dependencies.getPeerManager();
      if (peerManager) {
        const senders = peerManager
          .getAllPeers()
          .flatMap((peer) => peer.connection.getSenders())
          .filter((sender) => sender.track?.kind === "video");

        for (const sender of senders) {
          await sender.replaceTrack(videoTrack);
        }
      }

      const oldVideoTrack = localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      if (videoTrack) {
        localStream.addTrack(videoTrack);
      }
      this.dependencies.ui.setLocalStream(localStream);
    } catch (error) {
      console.error("Failed to stop screen share:", error);
    }
  }

  private stopScreenStream(): void {
    if (!this.screenStream) return;

    for (const track of this.screenStream.getTracks()) {
      track.onended = null;
      track.stop();
    }
    this.screenStream = null;
  }
}
