import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Uploads are authenticated but still abuse-prone (disk + bandwidth).
const UPLOAD_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const STORAGE_ROOT = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "storage");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  // Audio types for voice notes
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
  "audio/m4a",
  "audio/aac",
  // Video types
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
]);

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

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB" }, { status: 400 });
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_");
    const key = `uploads/${session.user.id}/${timestamp}-${sanitizedFileName}`;

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
