/** Shared upload size / MIME limits for local-disk uploads. */

export const REQUEST_ATTACHMENT_MAX_MB = 500;
export const PAYMENT_PROOF_MAX_MB = 10;

export const REQUEST_ATTACHMENT_MAX_BYTES = REQUEST_ATTACHMENT_MAX_MB * 1024 * 1024;
export const PAYMENT_PROOF_MAX_BYTES = PAYMENT_PROOF_MAX_MB * 1024 * 1024;

/** Chunk size for heavy uploads (kept under typical proxy body limits). */
export const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Files at or below this size use the simple single-shot POST /api/upload.
 * Larger files use the chunked init/chunk/complete flow.
 */
export const SINGLE_SHOT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  // Audio (voice notes)
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
  "audio/m4a",
  "audio/aac",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
]);

export const UPLOAD_ACCEPT_ATTR = "image/*,.pdf,.zip,audio/*,video/*";

/** Public creator-application CV uploads (PDF / Word). */
export const PROVIDER_CV_MAX_MB = 50;
export const PROVIDER_CV_MAX_BYTES = PROVIDER_CV_MAX_MB * 1024 * 1024;
export const PROVIDER_CV_ACCEPT_ATTR =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ALLOWED_PROVIDER_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Strip `;codecs=…` / parameters — mobile MediaRecorder often sends these. */
export function normalizeUploadMime(type: string): string {
  if (typeof type !== "string") return "";
  const base = type.split(";")[0]?.trim().toLowerCase() ?? "";
  // Common aliases from iOS / Android pickers
  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  if (base === "audio/mp3") return "audio/mpeg";
  if (base === "audio/wave" || base === "audio/x-wav") return "audio/wav";
  return base;
}

export function isAllowedUploadMime(type: string, filename?: string): boolean {
  const resolved = resolveUploadMime(type, filename);
  return Boolean(resolved) && ALLOWED_UPLOAD_MIME_TYPES.has(resolved);
}

/** Prefer browser MIME; fall back to extension (iOS often sends an empty type). */
export function resolveUploadMime(type: string, filename?: string): string {
  const normalized = normalizeUploadMime(type);
  if (normalized && ALLOWED_UPLOAD_MIME_TYPES.has(normalized)) return normalized;
  if (filename) {
    const inferred = contentTypeFromFilename(filename);
    if (inferred !== "application/octet-stream" && ALLOWED_UPLOAD_MIME_TYPES.has(inferred)) {
      return inferred;
    }
  }
  return normalized;
}

/** Infer a safe Content-Type when metadata is missing (common for older uploads). */
export function contentTypeFromFilename(filenameOrKey: string, fallback?: string): string {
  const normalizedFallback = fallback ? normalizeUploadMime(fallback) : "";
  if (normalizedFallback && normalizedFallback !== "application/octet-stream") {
    return normalizedFallback;
  }

  const clean = filenameOrKey.split("?")[0] ?? filenameOrKey;
  const ext = clean.includes(".") ? (clean.split(".").pop() || "").toLowerCase() : "";
  const lower = clean.toLowerCase();

  switch (ext) {
    case "webm":
      // Voice recordings are audio; other .webm may be video.
      return lower.includes("voice") ? "audio/webm" : "video/webm";
    case "m4a":
    case "mp4":
      return ext === "m4a" || lower.includes("voice") ? "audio/mp4" : "video/mp4";
    case "mp3":
    case "mpeg":
      return "audio/mpeg";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "aac":
      return "audio/aac";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return normalizedFallback || "application/octet-stream";
  }
}

export function resolveProviderCvMime(type: string, filename?: string): string {
  const normalized = normalizeUploadMime(type);
  if (normalized && ALLOWED_PROVIDER_CV_MIME_TYPES.has(normalized)) return normalized;
  if (filename) {
    const inferred = contentTypeFromFilename(filename);
    if (ALLOWED_PROVIDER_CV_MIME_TYPES.has(inferred)) return inferred;
  }
  return normalized;
}

export function isAllowedProviderCvMime(type: string, filename?: string): boolean {
  const resolved = resolveProviderCvMime(type, filename);
  return Boolean(resolved) && ALLOWED_PROVIDER_CV_MIME_TYPES.has(resolved);
}
