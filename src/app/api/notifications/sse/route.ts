import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setSseNotificationSender } from "@/lib/notifications";
import { getSseClients, sendNotificationToUser } from "@/lib/notifications/sse-utils";
import { getLocaleFromCookie } from "@/lib/notifications/i18n-helper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Register the SSE sender function (only logs once globally)
if (typeof globalThis !== "undefined" && !(globalThis as any).__sseInitialized) {
  setSseNotificationSender(sendNotificationToUser);
  (globalThis as any).__sseInitialized = true;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    logger.info("❌ SSE: Unauthorized access attempt");
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const clients = getSseClients();

  // Extract locale from cookies on this connection
  const cookieHeader = request.headers.get("cookie") || "";
  const locale = getLocaleFromCookie(cookieHeader);

  const stream = new ReadableStream({
    start(controller) {
      // Store the connection with locale
      clients.set(userId, { controller, locale });

      // Send initial connection message
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
        } catch {
          // Failed to enqueue, connection likely closed
          clearInterval(heartbeat);
          clients.delete(userId);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clients.delete(userId);
        try {
          controller.close();
        } catch {
          // Connection already closed, ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
