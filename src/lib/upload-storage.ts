import path from "node:path";
import { randomUUID } from "node:crypto";

export const STORAGE_ROOT = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "storage");

export function sanitizeUploadFileName(name: string): string {
  return name.replaceAll(/[^a-zA-Z0-9.-]/g, "_");
}

export function userUploadsDir(userId: string): string {
  return path.join(STORAGE_ROOT, "uploads", userId);
}

export function chunkTmpDir(userId: string, uploadId: string): string {
  return path.join(userUploadsDir(userId), ".tmp", uploadId);
}

export function newUploadId(): string {
  return randomUUID();
}

export function buildFinalObjectKey(userId: string, originalName: string): string {
  const timestamp = Date.now();
  const sanitized = sanitizeUploadFileName(originalName);
  return `uploads/${userId}/${timestamp}-${sanitized}`;
}

export function absoluteFromKey(key: string): string | null {
  const root = path.resolve(STORAGE_ROOT);
  const filePath = path.resolve(root, key);
  if (!filePath.startsWith(`${root}${path.sep}`)) return null;
  return filePath;
}
