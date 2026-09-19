import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { REQUEST_ATTACHMENT_MAX_BYTES } from "@/lib/upload-limits";
import { buildFinalObjectKey, chunkTmpDir, STORAGE_ROOT } from "@/lib/upload-storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const COMPLETE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(
      `upload-complete:${session.user.id}:${getClientIp(req)}`,
      COMPLETE_RATE_LIMIT
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = (await req.json()) as { uploadId?: string };
    const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
    if (!uploadId) {
      return NextResponse.json({ error: "uploadId required" }, { status: 400 });
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

    const dataPath = path.join(tmpDir, "data.bin");
    let fileStat;
    try {
      fileStat = await stat(dataPath);
    } catch {
      return NextResponse.json({ error: "No uploaded data" }, { status: 400 });
    }

    if (fileStat.size !== meta.expectedSize || meta.receivedBytes !== meta.expectedSize) {
      return NextResponse.json(
        {
          error: "Incomplete upload",
          receivedBytes: meta.receivedBytes,
          expectedSize: meta.expectedSize,
          onDisk: fileStat.size,
        },
        { status: 400 }
      );
    }

    if (fileStat.size > REQUEST_ATTACHMENT_MAX_BYTES) {
      await rm(tmpDir, { recursive: true, force: true });
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const key = buildFinalObjectKey(session.user.id, meta.originalName);
    const finalPath = path.join(STORAGE_ROOT, key);
    await mkdir(path.dirname(finalPath), { recursive: true });
    await rename(dataPath, finalPath);

    await writeFile(
      `${finalPath}.meta.json`,
      JSON.stringify({
        originalName: meta.originalName,
        contentType: meta.contentType,
        size: fileStat.size,
        uploadedAt: new Date().toISOString(),
      })
    );

    await rm(tmpDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      url: `/api/files/${key}`,
      filename: meta.originalName,
      size: fileStat.size,
      type: meta.contentType,
    });
  } catch (error) {
    logger.error("Upload complete error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
