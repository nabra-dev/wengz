import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  isAllowedUploadMime,
  REQUEST_ATTACHMENT_MAX_BYTES,
  REQUEST_ATTACHMENT_MAX_MB,
  UPLOAD_CHUNK_SIZE,
} from "@/lib/upload-limits";
import { chunkTmpDir, newUploadId } from "@/lib/upload-storage";

export const runtime = "nodejs";

const INIT_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

type InitBody = {
  filename?: string;
  contentType?: string;
  size?: number;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(
      `upload-init:${session.user.id}:${getClientIp(req)}`,
      INIT_RATE_LIMIT
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json()) as InitBody;
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : Number.NaN;

    if (!filename || !contentType || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Invalid upload metadata" }, { status: 400 });
    }

    if (!isAllowedUploadMime(contentType)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    if (size > REQUEST_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${REQUEST_ATTACHMENT_MAX_MB}MB` },
        { status: 400 }
      );
    }

    const uploadId = newUploadId();
    const tmpDir = chunkTmpDir(session.user.id, uploadId);
    await mkdir(tmpDir, { recursive: true });

    const meta = {
      uploadId,
      userId: session.user.id,
      originalName: filename,
      contentType,
      expectedSize: size,
      receivedBytes: 0,
      createdAt: new Date().toISOString(),
    };
    await writeFile(path.join(tmpDir, "meta.json"), JSON.stringify(meta));

    return NextResponse.json({
      uploadId,
      chunkSize: UPLOAD_CHUNK_SIZE,
      maxBytes: REQUEST_ATTACHMENT_MAX_BYTES,
    });
  } catch (error) {
    logger.error("Upload init error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
