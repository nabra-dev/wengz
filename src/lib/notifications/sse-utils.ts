// SSE notification utilities
// Separate file to avoid Next.js route export restrictions

import { getTranslation } from "./i18n-helper";
import { logger } from "@/lib/logger";

export type ClientConn = {
  controller: ReadableStreamDefaultController;
  locale: string; // 'en' | 'ar'
};

// Use global storage to persist across HMR reloads — multiple tabs/devices per user
const getClientsMap = () => {
  if (!(globalThis as any).__sseClients) {
    (globalThis as any).__sseClients = new Map<string, ClientConn[]>();
  }
  return (globalThis as any).__sseClients as Map<string, ClientConn[]>;
};

const clients = getClientsMap();

export function getConnectedClients() {
  return Array.from(clients.keys());
}

export function addSseClient(userId: string, conn: ClientConn) {
  const existing = clients.get(userId) ?? [];
  clients.set(userId, [...existing, conn]);
}

export function removeSseClient(userId: string, controller: ReadableStreamDefaultController) {
  const existing = clients.get(userId);
  if (!existing) return;
  const next = existing.filter((c) => c.controller !== controller);
  if (next.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, next);
  }
}

async function enqueueToConn(conn: ClientConn, notification: any) {
  let payload = notification;

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
}

// Function to send notifications to users (all open tabs/devices)
export async function sendNotificationToUser(userId: string, notification: any) {
  const conns = clients.get(userId);
  if (!conns?.length) return;

  const stale: ReadableStreamDefaultController[] = [];

  await Promise.all(
    conns.map(async (conn) => {
      try {
        await enqueueToConn(conn, notification);
      } catch (error) {
        logger.error(`SSE error for user ${userId}:`, error);
        stale.push(conn.controller);
      }
    })
  );

  for (const controller of stale) {
    removeSseClient(userId, controller);
  }
}

export function getSseClients() {
  return clients;
}

export function broadcastNotification(userIds: string[], notification: any) {
  userIds.forEach((userId) => void sendNotificationToUser(userId, notification));
}
