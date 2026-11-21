import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setSseNotificationSender } from "@/lib/notifications";
import {
  addSseClient,
  removeSseClient,
  sendNotificationToUser,
} from "@/lib/notifications/sse-utils";
import {
  extractBearerToken,
  resolveRequestLocale,
  sessionFromBearerToken,
} from "@/lib/mobile-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Register the SSE sender function (only logs once globally)
if (typeof globalThis !== "undefined" && !(globalThis as any).__sseInitialized) {
  setSseNotificationSender(sendNotificationToUser);
  (globalThis as any).__sseInitialized = true;
}

export async function GET(request: Request) {
  // Cookie session (web) or Bearer JWT (mobile)
  let userId: string | undefined;
  const bearer = extractBearerToken(request.headers);
  if (bearer) {
    const mobileSession = await sessionFromBearerToken(bearer);
    userId = mobileSession?.user?.id;
  } else {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id;
  }

  if (!userId) {
    logger.info("❌ SSE: Unauthorized access attempt");
    return new Response("Unauthorized", { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const locale = resolveRequestLocale(request.headers, cookieHeader);

  const stream = new ReadableStream({
    start(controller) {
      const conn = { controller, locale };
      addSseClient(userId, conn);

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
          removeSseClient(userId, controller);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeSseClient(userId, controller);
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
