// SSE notification utilities
// Separate file to avoid Next.js route export restrictions

import { getTranslation } from "./i18n-helper";
import { logger } from "@/lib/logger";

type ClientConn = {
  controller: ReadableStreamDefaultController;
  locale: string; // 'en' | 'ar'
};

// Use global storage to persist across HMR reloads
const getClientsMap = () => {
  if (!(globalThis as any).__sseClients) {
    (globalThis as any).__sseClients = new Map<string, ClientConn>();
  }
  return (globalThis as any).__sseClients as Map<string, ClientConn>;
};

const clients = getClientsMap();

// Helper function to check connected clients
export function getConnectedClients() {
  return Array.from(clients.keys());
}

// Function to send notifications to users
export async function sendNotificationToUser(userId: string, notification: any) {
  const conn = clients.get(userId);

  if (conn) {
    try {
      let payload = notification;

      // If i18n keys + params provided, format per-client locale
      if (notification?.i18n && typeof notification.i18n === "object") {
        const { titleKey, titleParams, messageKey, messageParams } = notification.i18n as {
          titleKey?: string;
          titleParams?: Record<string, string>;
          messageKey?: string;
          messageParams?: Record<string, string>;
        };

        const locale = conn.locale || "en";

        const title = titleKey
          ? await getTranslation(locale, titleKey, titleParams || {})
          : notification.title;
        const message = messageKey
          ? await getTranslation(locale, messageKey, messageParams || {})
          : notification.message;

        payload = { ...notification, title, message };
      }

      const data = `data: ${JSON.stringify(payload)}\n\n`;
      conn.controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      logger.error(`SSE error for user ${userId}:`, error);
      clients.delete(userId);
    }
  }
}

// Get the clients map for route handler
export function getSseClients() {
  return clients;
}

// Helper to broadcast to multiple users
export function broadcastNotification(userIds: string[], notification: any) {
  userIds.forEach((userId) => void sendNotificationToUser(userId, notification));
}
