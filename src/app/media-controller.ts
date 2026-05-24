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
  private recordingAnimationFrame = 0;
  private recordingAudioContext: AudioContext | null = null;
  private recordingAudioSources: MediaStreamAudioSourceNode[] = [];
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
      const recordingStream = this.createRecordingStream(localStream);
      const mimeType = this.getRecordingMimeType();

      this.mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.downloadRecording(mimeType);
        this.cleanupRecordingResources();
      };

      this.mediaRecorder.start(1000);
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
      this.cleanupRecordingResources();
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

  private createRecordingStream(localStream: MediaStream): MediaStream {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;

    const stream = canvas.captureStream(30);
    const mixedAudioStream = this.createMixedAudioStream(localStream);
    for (const track of mixedAudioStream.getAudioTracks()) {
      stream.addTrack(track);
    }

    this.renderRecordingFrame(canvas);
    return stream;
  }

  private createMixedAudioStream(localStream: MediaStream): MediaStream {
    const audioStreams = [
      this.screenStream ?? localStream,
      ...(this.dependencies
        .getPeerManager()
        ?.getAllPeers()
        .map((peer) => peer.stream) ?? []),
    ].filter((stream): stream is MediaStream => Boolean(stream?.getAudioTracks().length));

    if (!audioStreams.length || typeof AudioContext === "undefined") {
      return new MediaStream();
    }

    this.recordingAudioContext = new AudioContext();
    const destination = this.recordingAudioContext.createMediaStreamDestination();

    for (const stream of audioStreams) {
      const source = this.recordingAudioContext.createMediaStreamSource(stream);
      source.connect(destination);
      this.recordingAudioSources.push(source);
    }

    return destination.stream;
  }

  private renderRecordingFrame(canvas: HTMLCanvasElement): void {
    const context = canvas.getContext("2d");
    if (!context) return;

    const draw = () => {
      const container = this.dependencies.ui.elements.videoGrid;
      const containerRect = container.getBoundingClientRect();

      context.fillStyle = "#0b0d10";
      context.fillRect(0, 0, canvas.width, canvas.height);

      if (containerRect.width > 0 && containerRect.height > 0) {
        const videoItems = this.getVisibleVideoItems();
        const scaleX = canvas.width / containerRect.width;
        const scaleY = canvas.height / containerRect.height;

        for (const item of videoItems) {
          const rect = item.getBoundingClientRect();
          const video = item.querySelector("video");
          if (!video) continue;

          const x = (rect.left - containerRect.left) * scaleX;
          const y = (rect.top - containerRect.top) * scaleY;
          const width = rect.width * scaleX;
          const height = rect.height * scaleY;

          context.fillStyle = "#121417";
          context.fillRect(x, y, width, height);
          this.drawVideoCover(context, video, x, y, width, height);
        }
      }

      this.recordingAnimationFrame = requestAnimationFrame(draw);
    };

    draw();
  }

  private getVisibleVideoItems(): HTMLElement[] {
    const items = Array.from(
      this.dependencies.ui.elements.videoGrid.querySelectorAll<HTMLElement>(".video-item"),
    ).filter((item) => {
      const rect = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    return [
      ...items.filter((item) => !item.classList.contains("local")),
      ...items.filter((item) => item.classList.contains("local")),
    ];
  }

  private drawVideoCover(
    context: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;

    const sourceRatio = video.videoWidth / video.videoHeight;
    const targetRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = video.videoWidth;
    let sourceHeight = video.videoHeight;

    if (sourceRatio > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (video.videoWidth - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / targetRatio;
      sourceY = (video.videoHeight - sourceHeight) / 2;
    }

    const isMirrored = getComputedStyle(video).transform.startsWith("matrix(-1,");
    context.save();
    if (isMirrored) {
      context.translate(x + width, y);
      context.scale(-1, 1);
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    } else {
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
    }
    context.restore();
  }

  private getRecordingMimeType(): string {
    return (
      ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      ) ?? ""
    );
  }

  private downloadRecording(mimeType: string): void {
    const recordingMimeType = this.mediaRecorder?.mimeType || mimeType || "video/webm";
    const extension = recordingMimeType.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(this.recordedChunks, { type: recordingMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MikroMeet-recording-${new Date().toISOString()}.${extension}`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private cleanupRecordingResources(): void {
    if (this.recordingAnimationFrame) {
      cancelAnimationFrame(this.recordingAnimationFrame);
      this.recordingAnimationFrame = 0;
    }

    for (const source of this.recordingAudioSources) {
      source.disconnect();
    }
    this.recordingAudioSources = [];
    void this.recordingAudioContext?.close();
    this.recordingAudioContext = null;
  }
}
