/**
 * Helpers for browser MediaRecorder voice notes.
 * Prefer mp4/AAC on Safari/iOS (plays everywhere); fall back to webm/opus on Chromium.
 */

export type PickedAudioMime = {
  /** Value passed to MediaRecorder (may include codecs). */
  mimeType: string;
  /** Base type stored on the uploaded File / metadata. */
  fileType: string;
  /** Filename extension without dot. */
  extension: string;
};

const CANDIDATES: Array<{ mimeType: string; fileType: string; extension: string }> = [
  // Safari / iOS — widely playable in <audio>
  { mimeType: "audio/mp4", fileType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", fileType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/aac", fileType: "audio/aac", extension: "aac" },
  // Chromium / Android / desktop Chrome
  { mimeType: "audio/webm;codecs=opus", fileType: "audio/webm", extension: "webm" },
  { mimeType: "audio/webm", fileType: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", fileType: "audio/ogg", extension: "ogg" },
];

export function pickSupportedAudioMime(): PickedAudioMime {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "", fileType: "audio/webm", extension: "webm" };
  }

  for (const candidate of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    } catch {
      // ignore unsupported probe errors
    }
  }

  // Let the browser pick a default container.
  return { mimeType: "", fileType: "audio/webm", extension: "webm" };
}

export function isAudioLikeFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  // Some mobile pickers leave type empty or use video/webm for audio-only clips.
  if (file.type === "video/webm" || file.type.startsWith("video/mp4")) {
    return /\.(webm|m4a|mp3|ogg|wav|aac|mp4)$/i.test(file.name);
  }
  if (!file.type) {
    return /\.(webm|m4a|mp3|ogg|wav|aac|mp4)$/i.test(file.name);
  }
  return false;
}
