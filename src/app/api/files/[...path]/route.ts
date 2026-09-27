import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { existsRequestFile, shouldAllowUnclaimedPendingFiles } from "@/lib/file-access";
import { logger } from "@/lib/logger";
import { canManageFinance, canManageRequests, isSuperAdmin } from "@/lib/roles";
import { contentTypeFromFilename } from "@/lib/upload-limits";

export const runtime = "nodejs";

const STORAGE_ROOT = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "storage");

/** Short-lived allow/deny cache — cuts repeated ACL hits for gallery/detail views. */
const ACL_TTL_MS = 60_000;
const ACL_CACHE_MAX = 2_000;
const aclCache = new Map<string, { allowed: boolean; expiresAt: number }>();

function aclCacheKey(userId: string, key: string) {
  return `${userId}:${key}`;
}

function getCachedAcl(userId: string, key: string): boolean | null {
  const entry = aclCache.get(aclCacheKey(userId, key));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    aclCache.delete(aclCacheKey(userId, key));
    return null;
  }
  return entry.allowed;
}

function setCachedAcl(userId: string, key: string, allowed: boolean) {
  if (aclCache.size >= ACL_CACHE_MAX) {
    const dropCount = Math.min(200, aclCache.size);
    const keys = aclCache.keys();
    for (let i = 0; i < dropCount; i++) {
      const next = keys.next();
      if (next.done) break;
      aclCache.delete(next.value);
    }
  }
  aclCache.set(aclCacheKey(userId, key), {
    allowed,
    expiresAt: Date.now() + ACL_TTL_MS,
  });
}

function resolveUploadPath(key: string) {
  const storageRoot = path.resolve(STORAGE_ROOT);
  const filePath = path.resolve(storageRoot, key);

  if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

/** Parse a single `bytes=start-end` Range header. Returns null if absent/unsatisfiable. */
function parseBytesRange(
  rangeHeader: string | null,
  size: number
): { start: number; end: number } | null {
  if (!rangeHeader || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const startToken = match[1] ?? "";
  const endToken = match[2] ?? "";
  let start = startToken === "" ? Number.NaN : Number.parseInt(startToken, 10);
  let end = endToken === "" ? Number.NaN : Number.parseInt(endToken, 10);

  if (Number.isNaN(start) && Number.isNaN(end)) return null;

  if (Number.isNaN(start)) {
    // suffix bytes: bytes=-N
    const suffix = end;
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else if (Number.isNaN(end)) {
    end = size - 1;
  }

  if (start < 0 || end < start || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

async function existsPaymentProof(key: string, url: string, userId?: string): Promise<boolean> {
  const proof = await db.paymentProof.findFirst({
    where: {
      ...(userId ? { userId } : {}),
      OR: [{ transferImage: url }, { transferImage: key }],
    },
    select: { id: true },
  });
  return !!proof;
}

async function existsWithdrawalReview(
  key: string,
  url: string,
  providerId?: string
): Promise<boolean> {
  const withdrawal = await db.withdrawalRequest.findFirst({
    where: {
      ...(providerId ? { providerId } : {}),
      OR: [{ reviewImage: url }, { reviewImage: key }],
    },
    select: { id: true },
  });
  return !!withdrawal;
}

async function existsProfileImage(url: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { image: url },
    select: { id: true },
  });
  return !!user;
}

async function anyGranted(checks: Promise<boolean>[]): Promise<boolean> {
  if (checks.length === 0) return false;

  return new Promise((resolve) => {
    let pending = checks.length;
    for (const check of checks) {
      void check.then(
        (ok) => {
          if (ok) resolve(true);
          else if (--pending === 0) resolve(false);
        },
        () => {
          if (--pending === 0) resolve(false);
        }
      );
    }
  });
}

/**
 * Files are private by default. Access is granted to:
 * - Super admin (full platform)
 * - Project managers for request attachments / comment files
 * - Finance managers for payment proofs / withdrawal review images
 * - the uploader (key is namespaced as uploads/<userId>/...)
 * - any signed-in user when the file is another user's profile photo
 * - request participants (client, assigned provider, watchers)
 * - providers browsing unclaimed PENDING jobs (attachments + attribute media)
 * - users who can see a record that references the file
 */
async function canAccessFile(userId: string, role: string, key: string): Promise<boolean> {
  if (!userId) return false;
  if (isSuperAdmin(role)) return true;
  if (key.startsWith(`uploads/${userId}/`)) return true;

  const cached = getCachedAcl(userId, key);
  if (cached !== null) return cached;

  const url = `/api/files/${key}`;
  const checks: Promise<boolean>[] = [];

  if (canManageFinance(role)) {
    checks.push(existsPaymentProof(key, url));
    checks.push(existsWithdrawalReview(key, url));
  }

  if (canManageRequests(role)) {
    checks.push(existsRequestFile(key, url));
  }

  // Profile photos are visible to any signed-in user.
  checks.push(existsProfileImage(url));

  // Owner / participant paths (clients, providers, watchers)
  checks.push(existsPaymentProof(key, url, userId));
  checks.push(existsWithdrawalReview(key, url, userId));
  checks.push(
    existsRequestFile(key, url, {
      participantUserId: userId,
      allowUnclaimedPending: shouldAllowUnclaimedPendingFiles(role),
    })
  );

  const allowed = await anyGranted(checks);
  setCachedAcl(userId, key, allowed);
  return allowed;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    // Prefer JWT from the request — more reliable than getServerSession
    // for <img src> / new-tab GETs in App Router route handlers.
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const userId = typeof token?.id === "string" ? token.id : null;
    const role = typeof token?.role === "string" ? token.role : "";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    const key = pathSegments.map((segment) => decodeURIComponent(segment)).join("/");

    if (!key.startsWith("uploads/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const filePath = resolveUploadPath(key);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const allowed = await canAccessFile(userId, role, key);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [fileStat, metadata] = await Promise.all([
      stat(filePath),
      readFile(`${filePath}.meta.json`, "utf8")
        .then((value) => JSON.parse(value) as { contentType?: string })
        .catch(() => null),
    ]);

    const contentType = contentTypeFromFilename(key, metadata?.contentType);
    const isInlineSafe =
      contentType.startsWith("image/") ||
      contentType.startsWith("audio/") ||
      contentType.startsWith("video/") ||
      contentType === "application/pdf";

    const size = fileStat.size;
    const range = parseBytesRange(req.headers.get("range"), size);

    const commonHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      // Private content; short browser reuse cuts repeat ACL hits on a page view.
      "Cache-Control": "private, max-age=60",
      ...(isInlineSafe ? {} : { "Content-Disposition": 'attachment; filename="download"' }),
      "X-Content-Type-Options": "nosniff",
    };

    // <audio>/<video> need byte ranges for duration + seeking (else 0:00/0:00 on many browsers).
    if (range) {
      const length = range.end - range.start + 1;
      const buffer = Buffer.alloc(length);
      const handle = await open(filePath, "r");
      try {
        await handle.read(buffer, 0, length, range.start);
      } finally {
        await handle.close();
      }

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Length": String(length),
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        },
      });
    }

    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Length": String(size),
      },
    });
  } catch (error) {
    logger.error("Failed to serve private file", {
      error: error instanceof Error ? error : undefined,
    });
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
