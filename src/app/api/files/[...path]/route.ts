import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const STORAGE_ROOT = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "storage");

function resolveUploadPath(key: string) {
  const storageRoot = path.resolve(STORAGE_ROOT);
  const filePath = path.resolve(storageRoot, key);

  if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

/**
 * Files are private by default. Access is granted to:
 * - SUPER_ADMIN
 * - the uploader (key is namespaced as uploads/<userId>/...)
 * - users who can see a record that references the file
 *   (request attachments, comment files, payment proof transfer image)
 */
async function canAccessFile(userId: string, role: string, key: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  if (key.startsWith(`uploads/${userId}/`)) return true;

  const url = `/api/files/${key}`;

  // Payment proofs reference the file via transferImage
  const proof = await db.paymentProof.findFirst({
    where: { userId, OR: [{ transferImage: url }, { transferImage: key }] },
    select: { id: true },
  });
  if (proof) return true;

  // Requests the user participates in (client, provider, or watcher)
  const request = await db.request.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { clientId: userId },
        { providerId: userId },
        { watchers: { some: { userId } } },
      ],
      AND: [
        {
          OR: [
            { attachments: { has: url } },
            { attachments: { has: key } },
            { comments: { some: { files: { has: url } } } },
            { comments: { some: { files: { has: key } } } },
          ],
        },
      ],
    },
    select: { id: true },
  });

  return !!request;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const key = path.join("/");

    if (!key.startsWith("uploads/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const filePath = resolveUploadPath(key);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const allowed = await canAccessFile(session.user.id, session.user.role, key);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [buffer, metadata] = await Promise.all([
      readFile(filePath),
      readFile(`${filePath}.meta.json`, "utf8")
        .then((value) => JSON.parse(value) as { contentType?: string })
        .catch(() => null),
    ]);

    const contentType = metadata?.contentType || "application/octet-stream";
    const isInlineSafe =
      contentType.startsWith("image/") ||
      contentType.startsWith("audio/") ||
      contentType.startsWith("video/") ||
      contentType === "application/pdf";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        // Private user content — never cache publicly.
        "Cache-Control": "private, no-cache",
        // Force download for anything that isn't a safe media type.
        ...(isInlineSafe
          ? {}
          : { "Content-Disposition": 'attachment; filename="download"' }),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error("File fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
