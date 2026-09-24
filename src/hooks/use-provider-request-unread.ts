"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import {
  clearUnreadSnapshotCache,
  getUnreadIdsSnapshot,
  markRequestRead,
  markRequestUnread,
  PROVIDER_UNREAD_EVENT,
} from "@/lib/provider-request-unread";

function subscribeUnread(userId: string, onStoreChange: () => void) {
  if (!userId) return () => {};

  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<{ userId?: string }>).detail;
    if (detail?.userId && detail.userId !== userId) return;
    clearUnreadSnapshotCache(userId);
    onStoreChange();
  };

  globalThis.addEventListener(PROVIDER_UNREAD_EVENT, onChange);
  globalThis.addEventListener("storage", onChange);
  return () => {
    globalThis.removeEventListener(PROVIDER_UNREAD_EVENT, onChange);
    globalThis.removeEventListener("storage", onChange);
  };
}

/**
 * Reactive unread request ids for the logged-in provider (localStorage-backed).
 */
export function useProviderRequestUnread() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  const unreadSerialized = useSyncExternalStore(
    (onStoreChange) => subscribeUnread(userId, onStoreChange),
    () => getUnreadIdsSnapshot(userId),
    () => "[]"
  );

  const unreadIds = useMemo(
    () => new Set<string>(JSON.parse(unreadSerialized) as string[]),
    [unreadSerialized]
  );

  const refresh = useCallback(() => {
    if (!userId) return;
    globalThis.dispatchEvent(
      new CustomEvent(PROVIDER_UNREAD_EVENT, { detail: { userId } })
    );
  }, [userId]);

  const markUnread = useCallback(
    (requestId: string) => {
      if (!userId) return;
      markRequestUnread(userId, requestId);
    },
    [userId]
  );

  const markRead = useCallback(
    (requestId: string) => {
      if (!userId) return;
      markRequestRead(userId, requestId);
    },
    [userId]
  );

  const isUnread = useCallback(
    (requestId: string) => unreadIds.has(requestId),
    [unreadIds]
  );

  return { unreadIds, isUnread, markUnread, markRead, refresh };
}
