import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";
import {
  isAllowedUploadMime,
  REQUEST_ATTACHMENT_MAX_BYTES,
  REQUEST_ATTACHMENT_MAX_MB,
  SINGLE_SHOT_UPLOAD_MAX_BYTES,
} from "@/lib/upload-limits";
import { buildFinalObjectKey, STORAGE_ROOT } from "@/lib/upload-storage";

export const runtime = "nodejs";

// Uploads are authenticated but still abuse-prone (disk + bandwidth).
const UPLOAD_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

/**
 * Single-shot multipart upload for smaller files.
 * Heavy files should use /api/upload/init → chunk → complete.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(
      `upload:${session.user.id}:${getClientIp(req)}`,
      UPLOAD_RATE_LIMIT
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isAllowedUploadMime(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Single-shot capped so this path never buffers a 500MB body in RAM.
    const maxForSingleShot = Math.min(SINGLE_SHOT_UPLOAD_MAX_BYTES, REQUEST_ATTACHMENT_MAX_BYTES);
    if (file.size > maxForSingleShot) {
      return NextResponse.json(
        {
          error: `File too large for single upload. Use chunked upload for files over ${Math.floor(maxForSingleShot / (1024 * 1024))}MB (max ${REQUEST_ATTACHMENT_MAX_MB}MB).`,
        },
        { status: 400 }
      );
    }

    const key = buildFinalObjectKey(session.user.id, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(STORAGE_ROOT, key);
    const metadataPath = `${filePath}.meta.json`;

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    await writeFile(
      metadataPath,
      JSON.stringify({
        originalName: file.name,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      })
    );

    return NextResponse.json({
      success: true,
      url: `/api/files/${key}`,
      filename: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    logger.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
