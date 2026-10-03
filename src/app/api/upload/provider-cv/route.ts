import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  isAllowedProviderCvMime,
  PROVIDER_CV_MAX_BYTES,
  PROVIDER_CV_MAX_MB,
  resolveProviderCvMime,
} from "@/lib/upload-limits";
import { buildApplicationCvObjectKey, STORAGE_ROOT } from "@/lib/upload-storage";

export const runtime = "nodejs";

const UPLOAD_RATE_LIMIT = { limit: 8, windowMs: 15 * 60_000 };

/**
 * Public, rate-limited CV upload for creator applications (unauthenticated).
 * Stores under uploads/applications/<uuid>/… — readable by staff via /api/files.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`upload-provider-cv:${ip}`, UPLOAD_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isAllowedProviderCvMime(file.type, file.name)) {
      return NextResponse.json(
        { error: "CV must be a PDF or Word document (.pdf, .doc, .docx)" },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > PROVIDER_CV_MAX_BYTES) {
      return NextResponse.json(
        { error: `CV must be under ${PROVIDER_CV_MAX_MB}MB` },
        { status: 400 }
      );
    }

    const contentType =
      resolveProviderCvMime(file.type, file.name) || file.type || "application/pdf";
    const key = buildApplicationCvObjectKey(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(STORAGE_ROOT, key);
    const metadataPath = `${filePath}.meta.json`;

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    await writeFile(
      metadataPath,
      JSON.stringify({
        originalName: file.name,
        contentType,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        purpose: "provider-cv",
      })
    );

    return NextResponse.json({
      success: true,
      url: `/api/files/${key}`,
      filename: file.name,
      size: file.size,
      type: contentType,
    });
  } catch (error) {
    logger.error("Provider CV upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
