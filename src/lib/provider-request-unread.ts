/**
 * Client-side unread markers for provider request lists.
 * Display-only: not synced to the server. Cleared when the provider opens a request.
 */

const STORAGE_KEY_PREFIX = "wengz-provider-unread-requests:";

/** Cached serialized snapshot for useSyncExternalStore equality checks. */
let snapshotCache: { userId: string; value: string } | null = null;

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function invalidateSnapshot(userId?: string) {
  if (!userId || snapshotCache?.userId === userId) {
    snapshotCache = null;
  }
}

/** Drop cached snapshot so the next read rehydrates from localStorage. */
export function clearUnreadSnapshotCache(userId?: string) {
  invalidateSnapshot(userId);
}

function readIds(userId: string): Set<string> {
  if (typeof window === "undefined" || !userId) return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeIds(userId: string, ids: Set<string>) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
  invalidateSnapshot(userId);
}

export function getUnreadRequestIds(userId: string): Set<string> {
  return readIds(userId);
}

/** Stable string snapshot for React external-store subscriptions. */
export function getUnreadIdsSnapshot(userId: string): string {
  if (!userId) return "[]";
  if (snapshotCache?.userId === userId) return snapshotCache.value;
  const value = JSON.stringify([...readIds(userId)].sort());
  snapshotCache = { userId, value };
  return value;
}

export function markRequestUnread(userId: string, requestId: string) {
  markRequestsUnread(userId, [requestId]);
}

/** Batch-add unread ids with a single storage write + event. */
export function markRequestsUnread(userId: string, requestIds: readonly string[]) {
  if (!userId || requestIds.length === 0) return;
  const ids = readIds(userId);
  let changed = false;
  for (const requestId of requestIds) {
    if (!requestId || ids.has(requestId)) continue;
    ids.add(requestId);
    changed = true;
  }
  if (!changed) return;
  writeIds(userId, ids);
  dispatchUnreadChange(userId);
}

export function markRequestRead(userId: string, requestId: string) {
  if (!userId || !requestId) return;
  const ids = readIds(userId);
  if (!ids.has(requestId)) return;
  ids.delete(requestId);
  writeIds(userId, ids);
  dispatchUnreadChange(userId);
}

export function isRequestUnread(userId: string, requestId: string): boolean {
  return readIds(userId).has(requestId);
}

export const PROVIDER_UNREAD_EVENT = "wengz:provider-unread-changed";

function dispatchUnreadChange(userId: string) {
  if (typeof window === "undefined") return;
  globalThis.dispatchEvent(
    new CustomEvent(PROVIDER_UNREAD_EVENT, { detail: { userId } })
  );
}

/** Extract a request id from provider/client request links. */
export function extractRequestIdFromLink(link?: string | null): string | null {
  if (!link) return null;
  const match = link.match(
    /\/(?:provider|client)\/(?:available|requests|my-requests)\/([a-zA-Z0-9_-]+)/
  );
  return match?.[1] ?? null;
}

export function isProviderJobsNotification(params: {
  type?: string;
  link?: string | null;
}): boolean {
  const link = params.link ?? "";
  const type = params.type ?? "";

  if (
    link.includes("/provider/available") ||
    link.includes("/provider/requests") ||
    link.includes("/provider/my-requests")
  ) {
    return true;
  }

  return type === "assignment" || type === "status_change" || type === "message";
}
