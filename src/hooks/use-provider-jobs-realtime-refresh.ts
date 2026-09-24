"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import {
  extractRequestIdFromLink,
  isProviderJobsNotification,
  markRequestsUnread,
} from "@/lib/provider-request-unread";

type NotificationEventDetail = {
  notification?: {
    type?: string;
    data?: { requestId?: string };
    link?: string;
  };
  link?: string;
};

/**
 * While on provider dashboard / available jobs, refetch lists when a relevant
 * realtime notification arrives, and mark the related request as unread.
 */
export function useProviderJobsRealtimeRefresh(requestIds?: string[]) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const utils = trpc.useUtils();
  const knownIdsRef = useRef<Set<string> | null>(null);
  const idsKey = useMemo(() => (requestIds ? [...requestIds].sort().join(",") : ""), [requestIds]);

  useEffect(() => {
    const onNotify = (event: Event) => {
      const detail = (event as CustomEvent<NotificationEventDetail>).detail;
      const notification = detail?.notification;
      const link = detail?.link ?? notification?.link ?? "";
      const type = notification?.type;

      if (!isProviderJobsNotification({ type, link })) {
        return;
      }

      const requestId =
        notification?.data?.requestId ?? extractRequestIdFromLink(link) ?? null;

      if (userId && requestId) {
        markRequestsUnread(userId, [requestId]);
      }

      void utils.provider.getAvailableRequests.invalidate();
      void utils.provider.getMyRequests.invalidate();
      void utils.provider.getStats.invalidate();
    };

    globalThis.addEventListener("wengz:notification", onNotify);
    return () => globalThis.removeEventListener("wengz:notification", onNotify);
  }, [utils, userId]);

  // After lists refresh, brand-new ids (not in the previous snapshot) become unread.
  useEffect(() => {
    if (!idsKey || !userId) return;

    const current = new Set(idsKey.split(",").filter(Boolean));
    const previous = knownIdsRef.current;

    if (previous) {
      const newlySeen: string[] = [];
      for (const id of current) {
        if (!previous.has(id)) newlySeen.push(id);
      }
      if (newlySeen.length > 0) {
        markRequestsUnread(userId, newlySeen);
      }
    }

    knownIdsRef.current = current;
  }, [idsKey, userId]);
}
