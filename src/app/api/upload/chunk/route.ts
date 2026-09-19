import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createWriteStream } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { REQUEST_ATTACHMENT_MAX_BYTES, UPLOAD_CHUNK_SIZE } from "@/lib/upload-limits";
import { chunkTmpDir } from "@/lib/upload-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHUNK_RATE_LIMIT = { limit: 240, windowMs: 60_000 };

type ChunkMeta = {
  uploadId: string;
  userId: string;
  originalName: string;
  contentType: string;
  expectedSize: number;
  receivedBytes: number;
  createdAt: string;
};

async function readMeta(tmpDir: string): Promise<ChunkMeta | null> {
  try {
    const raw = await readFile(path.join(tmpDir, "meta.json"), "utf8");
    return JSON.parse(raw) as ChunkMeta;
  } catch {
    return null;
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uploadId = req.headers.get("x-upload-id")?.trim();
    const chunkIndexHeader = req.headers.get("x-chunk-index");
    const chunkIndex = chunkIndexHeader ? Number(chunkIndexHeader) : Number.NaN;

    if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: "Missing chunk headers" }, { status: 400 });
    }

    const rl = rateLimit(
      `upload-chunk:${session.user.id}:${uploadId}:${getClientIp(req)}`,
      CHUNK_RATE_LIMIT
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many upload chunks. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const tmpDir = chunkTmpDir(session.user.id, uploadId);
    try {
      await access(tmpDir);
    } catch {
      return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
    }

    const meta = await readMeta(tmpDir);
    if (!meta || meta.userId !== session.user.id) {
      return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
    }

    if (meta.receivedBytes >= meta.expectedSize) {
      return NextResponse.json({ error: "Upload already complete" }, { status: 409 });
    }

    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > UPLOAD_CHUNK_SIZE + 64 * 1024) {
      return NextResponse.json({ error: "Chunk too large" }, { status: 400 });
    }

    const remaining = meta.expectedSize - meta.receivedBytes;
    const hardCap = Math.min(
      REQUEST_ATTACHMENT_MAX_BYTES - meta.receivedBytes,
      remaining,
      UPLOAD_CHUNK_SIZE + 64 * 1024
    );

    if (declared > 0 && declared > hardCap) {
      return NextResponse.json({ error: "Chunk exceeds remaining file size" }, { status: 400 });
    }

    if (!req.body) {
      return NextResponse.json({ error: "Empty chunk body" }, { status: 400 });
    }

    const partPath = path.join(tmpDir, "data.bin");
    const writeStream = createWriteStream(partPath, { flags: "a" });

    const reader = req.body.getReader();
    let written = 0;
    let overflow = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;

        if (written + value.byteLength > hardCap) {
          overflow = true;
          break;
        }

        written += value.byteLength;
        const canContinue = writeStream.write(Buffer.from(value));
        if (!canContinue) {
          await new Promise<void>((resolve, reject) => {
            writeStream.once("drain", resolve);
            writeStream.once("error", reject);
          });
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
      });
    }

    if (overflow || written === 0) {
      return NextResponse.json(
        { error: overflow ? "Chunk exceeds remaining file size" : "Empty chunk body" },
        { status: 400 }
      );
    }

    meta.receivedBytes += written;
    await writeFile(path.join(tmpDir, "meta.json"), JSON.stringify(meta));

    return NextResponse.json({
      uploadId,
      chunkIndex,
      receivedBytes: meta.receivedBytes,
      expectedSize: meta.expectedSize,
    });
  } catch (error) {
    logger.error("Upload chunk error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
