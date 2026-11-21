/** Classify chat / upload URLs for preview (mirrors web `src/lib/file-display.ts`). */

export type FileKind = "image" | "audio" | "video" | "pdf" | "archive" | "other";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);
const AUDIO_EXT = new Set(["mp3", "mpeg", "ogg", "oga", "wav", "m4a", "aac", "caf", "3gp"]);
const VIDEO_EXT = new Set(["mp4", "mov", "avi", "mkv", "mpeg", "flv"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz"]);

export function getExtension(urlOrName: string): string {
  try {
    const clean = urlOrName.split("?")[0] ?? urlOrName;
    const base = clean.split("/").pop() ?? clean;
    const parts = base.split(".");
    return parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
  } catch {
    return "";
  }
}

export function prettyFilename(name: string): string {
  let result = name.trim();
  if (!result) return "";

  result = result.replace(/^\d{10,}-/, "");
  result = result.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-?/i, "");
  result = result.replace(/^voice-?(note)?-?\d*-?/i, "");
  result = result.replace(/^\d{8,}-/, "");
  result = result.replace(/^-+/, "").trim();

  const ext = getExtension(result);
  const stem = ext ? result.slice(0, -(ext.length + 1)) : result;
  if (!stem || /^[0-9a-f-]{8,}$/i.test(stem)) {
    return ext ? `.${ext}` : "";
  }

  if (result.length > 48) {
    const keepExt = ext ? `.${ext}` : "";
    const maxStem = 40 - keepExt.length;
    return `${stem.slice(0, Math.max(8, maxStem))}…${keepExt}`;
  }

  return result;
}

export function detectFileKind(url: string): FileKind {
  const ext = getExtension(url);
  const lower = url.toLowerCase();

  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext) || /voice[^/]*\.(webm|mp4|m4a)$/i.test(lower)) return "audio";
  if (ext === "webm") return /voice/i.test(lower) ? "audio" : "video";
  if (VIDEO_EXT.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (ARCHIVE_EXT.has(ext)) return "archive";
  return "other";
}
