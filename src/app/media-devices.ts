export interface MediaAcquisitionResult {
  stream: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  warning?: string;
}

export async function getLocalMediaWithFallback(options: {
  audio: boolean;
  video: boolean;
}): Promise<MediaAcquisitionResult> {
  try {
    return {
      stream: await navigator.mediaDevices.getUserMedia(buildConstraints(options)),
      audioEnabled: options.audio,
      videoEnabled: options.video,
    };
  } catch (error) {
    if (isPermissionDenied(error)) throw error;

    if (options.video && options.audio) {
      const audioOnly = await tryGetMedia({ audio: true, video: false });
      if (audioOnly) {
        return {
          stream: audioOnly,
          audioEnabled: true,
          videoEnabled: false,
          warning: "Camera was unavailable, so you joined with audio only.",
        };
      }

      const videoOnly = await tryGetMedia({ audio: false, video: true });
      if (videoOnly) {
        return {
          stream: videoOnly,
          audioEnabled: false,
          videoEnabled: true,
          warning: "Microphone was unavailable, so you joined with camera only.",
        };
      }
    }

    if (typeof MediaStream !== "undefined") {
      return {
        stream: new MediaStream(),
        audioEnabled: false,
        videoEnabled: false,
        warning: "No camera or microphone was available, so you joined without media.",
      };
    }

    throw error;
  }
}

async function tryGetMedia(options: {
  audio: boolean;
  video: boolean;
}): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia(buildConstraints(options));
  } catch {
    return null;
  }
}

function buildConstraints(options: { audio: boolean; video: boolean }): MediaStreamConstraints {
  return {
    video: options.video
      ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        }
      : false,
    audio: options.audio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false,
  };
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}
