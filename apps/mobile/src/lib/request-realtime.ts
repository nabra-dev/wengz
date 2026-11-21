const ACTIVE_REQUEST_STATUSES = new Set([
  "PENDING",
  "IN_PROGRESS",
  "REVISION_REQUESTED",
  "DELIVERED",
]);

/** Fallback poll when SSE is quiet — keep light; prefer SSE invalidation. */
const REQUEST_THREAD_POLLING_INTERVAL_MS = 15_000;

/** Same cadence as web `src/lib/request-realtime.ts`. */
export function getRequestThreadPollingInterval(status: unknown): number | false {
  if (typeof status !== "string") return REQUEST_THREAD_POLLING_INTERVAL_MS;
  if (ACTIVE_REQUEST_STATUSES.has(status)) return REQUEST_THREAD_POLLING_INTERVAL_MS;
  return false;
}

export function requestIdFromNotificationLink(link?: string | null): string | null {
  if (!link) return null;
  const match = link.match(/\/requests\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export function isRequestThreadNotificationType(type?: string | null): boolean {
  return type === "message" || type === "status_change";
}

/** Client-facing request updates that should raise an OS banner. */
export function isClientRequestUpdateNotificationType(type?: string | null): boolean {
  return type === "message" || type === "status_change" || type === "assignment";
}
