import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { usePathname } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { connectNotificationsSse, type SseNotification } from "../lib/notifications-sse";
import {
  isClientRequestUpdateNotificationType,
  isRequestThreadNotificationType,
  requestIdFromNotificationLink,
} from "../lib/request-realtime";
import { presentRequestUpdateNotification, setupNotificationResponseListener } from "../lib/push";

/**
 * Mirrors web SSE: invalidate request queries on thread events, and surface an
 * OS notification for every client-facing request update (message, status,
 * assignment) unless the user is already on that thread.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth();
  const qc = useQueryClient();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const disconnectRef = useRef<(() => void) | null>(null);
  const seenNotificationIds = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !token) return;
    let cleanup: (() => void) | undefined;
    void setupNotificationResponseListener().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [ready, token]);

  useEffect(() => {
    if (!ready || !token) {
      disconnectRef.current?.();
      disconnectRef.current = null;
      return;
    }

    const handleEvent = (notification: SseNotification) => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread"] });

      const link = notification.link ?? notification.data?.link ?? null;
      const requestId =
        (typeof notification.data?.requestId === "string" ? notification.data.requestId : null) ||
        requestIdFromNotificationLink(link);

      if (requestId && isRequestThreadNotificationType(notification.type)) {
        void qc.invalidateQueries({ queryKey: ["request", requestId] });
        void qc.invalidateQueries({ queryKey: ["requests"] });
      } else if (requestId && notification.type === "assignment") {
        void qc.invalidateQueries({ queryKey: ["request", requestId] });
        void qc.invalidateQueries({ queryKey: ["requests"] });
      }

      if (!isClientRequestUpdateNotificationType(notification.type) || !requestId) return;

      const notificationId =
        typeof notification.data?.notificationId === "string"
          ? notification.data.notificationId
          : null;
      if (notificationId) {
        if (seenNotificationIds.current.has(notificationId)) return;
        seenNotificationIds.current.add(notificationId);
        if (seenNotificationIds.current.size > 80) {
          const first = seenNotificationIds.current.values().next().value;
          if (first) seenNotificationIds.current.delete(first);
        }
      }

      const viewingThisThread = (pathnameRef.current || "").includes(`/requests/${requestId}`);
      if (viewingThisThread && AppState.currentState === "active") return;

      void presentRequestUpdateNotification({
        title: notification.title || "Wengz",
        body: notification.message || "",
        type: notification.type,
        requestId,
        link,
        notificationId,
      });
    };

    const connect = () => {
      disconnectRef.current?.();
      disconnectRef.current = connectNotificationsSse({
        onEvent: handleEvent,
      });
    };

    connect();

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        connect();
        void qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      sub.remove();
      disconnectRef.current?.();
      disconnectRef.current = null;
    };
  }, [ready, token, qc]);

  return <>{children}</>;
}
