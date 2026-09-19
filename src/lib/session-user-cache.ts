import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { getCached, setCached, deleteCached, cacheKeys } from "@/lib/cache";

const SESSION_USER_TTL_SECONDS = 45;
const MEMORY_TTL_MS = SESSION_USER_TTL_SECONDS * 1000;

type SessionUserSnapshot = {
  id: string;
  role: "CLIENT" | "PROVIDER" | "SUPER_ADMIN";
  deletedAt: Date | null;
};

type MemoryEntry = {
  value: SessionUserSnapshot;
  expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();

function sessionUserCacheKey(userId: string) {
  return `session:user:${userId}`;
}

/**
 * Revalidate JWT session user against DB with a short TTL cache.
 * Role changes / soft-deletes still apply within ~45s; avoids N DB hits per batched page.
 */
export async function revalidateSessionUser(userId: string): Promise<SessionUserSnapshot> {
  const now = Date.now();
  const mem = memoryCache.get(userId);
  if (mem && mem.expiresAt > now) {
    if (mem.value.deletedAt) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Your account is no longer active. Please sign in again.",
      });
    }
    return mem.value;
  }

  const cacheKey = sessionUserCacheKey(userId);
  const cached = await getCached<SessionUserSnapshot>(cacheKey);
  if (cached) {
    memoryCache.set(userId, { value: cached, expiresAt: now + MEMORY_TTL_MS });
    if (cached.deletedAt) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Your account is no longer active. Please sign in again.",
      });
    }
    return cached;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    memoryCache.delete(userId);
    await deleteCached(cacheKey);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your account is no longer active. Please sign in again.",
    });
  }

  const snapshot: SessionUserSnapshot = {
    id: user.id,
    role: user.role,
    deletedAt: user.deletedAt,
  };

  memoryCache.set(userId, { value: snapshot, expiresAt: now + MEMORY_TTL_MS });
  await setCached(cacheKey, snapshot, SESSION_USER_TTL_SECONDS);
  // Also keep taxonomy key warm for invalidation helpers
  await setCached(cacheKeys.USER(userId), snapshot, SESSION_USER_TTL_SECONDS);

  return snapshot;
}

/** Call after admin role changes or soft-deletes so the next request sees fresh state. */
export async function invalidateSessionUserCache(userId: string): Promise<void> {
  memoryCache.delete(userId);
  await deleteCached([sessionUserCacheKey(userId), cacheKeys.USER(userId)]);
}
