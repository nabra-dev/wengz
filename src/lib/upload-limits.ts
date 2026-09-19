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

export function isAllowedUploadMime(type: string): boolean {
  return ALLOWED_UPLOAD_MIME_TYPES.has(type);
}
