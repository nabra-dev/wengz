const ACTIVE_REQUEST_STATUSES = new Set([
  "PENDING",
  "IN_PROGRESS",
  "REVISION_REQUESTED",
  "DELIVERED",
]);

/** Fallback poll when SSE is quiet — keep light; prefer SSE invalidation. */
const REQUEST_THREAD_POLLING_INTERVAL_MS = 15_000;

export function getRequestThreadPollingInterval(status: unknown): number | false {
  if (typeof status !== "string") return REQUEST_THREAD_POLLING_INTERVAL_MS;
  if (ACTIVE_REQUEST_STATUSES.has(status)) return REQUEST_THREAD_POLLING_INTERVAL_MS;
  return false;
}
