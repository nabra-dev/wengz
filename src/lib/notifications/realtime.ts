// Re-export from centralized SSE utilities to avoid duplicate notification senders
// This file is kept for backward compatibility

import { sendNotificationToUser, broadcastNotification } from "./sse-utils";
import { logger } from "@/lib/logger";

type NotificationType = "message" | "status_change" | "assignment" | "general";

interface RealtimeNotification {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
}

// Deprecated: Use sendNotificationToUser from sse-utils instead
export function setNotificationSender(
  _sender: (userId: string, notification: RealtimeNotification) => void
) {
  logger.warn("setNotificationSender is deprecated. SSE clients are managed centrally.");
}

export function sendRealtimeNotification(
  userId: string,
  notification: Omit<RealtimeNotification, "timestamp">
) {
  const fullNotification: RealtimeNotification = {
    ...notification,
    timestamp: new Date(),
  };
  sendNotificationToUser(userId, fullNotification);
}

export function broadcastToUsers(
  userIds: string[],
  notification: Omit<RealtimeNotification, "timestamp">
) {
  const fullNotification: RealtimeNotification = {
    ...notification,
    timestamp: new Date(),
  };
  broadcastNotification(userIds, fullNotification);
}

// Re-export for backward compatibility
export { getSseClients } from "./sse-utils";
