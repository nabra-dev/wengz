/**
 * Lightweight in-memory rate limiter (fixed window per key).
 *
 * Suitable for a single Node process (which this app requires anyway for
 * in-memory SSE). If the app ever scales to multiple instances, swap the
 * store for Redis without changing call sites.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map does not grow unbounded.
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Do not keep the process alive just for cleanup.
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  /** Unix ms when the current window resets. */
  resetAt: number;
  /** Seconds the caller should wait before retrying (when blocked). */
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(key, bucket);
    return {
      success: true,
      remaining: options.limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > options.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    };
  }

  return {
    success: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

/** Best-effort client IP from proxy headers (Nginx / Vercel). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
