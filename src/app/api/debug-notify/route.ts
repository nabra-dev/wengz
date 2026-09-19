import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Import the SSE sender directly
let sseSender: any = null;

// Helper function to register SSE sender (called from SSE route)
// Not exported as it's not a Next.js route handler
function registerSseSender(sender: any) {
  sseSender = sender;
  logger.info("🔧 Debug: SSE sender registered in debug route");
}

// Make it available globally for SSE route to call
if (typeof globalThis !== "undefined") {
  (globalThis as any).__registerDebugSseSender = registerSseSender;
}

export async function GET() {
  // Debug endpoint — development only, must not ship to production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  logger.info("🧪 Debug notify called for user:", userId);
  logger.info("🔍 SSE sender available:", !!sseSender);

  if (!sseSender) {
    return NextResponse.json(
      {
        error: "SSE sender not registered",
        hint: "Make sure you have an active SSE connection",
      },
      { status: 503 }
    );
  }

  try {
    // Try to send a test notification directly through SSE
    sseSender(userId, {
      type: "general",
      title: "Debug Test",
      message: "Direct SSE test from debug endpoint",
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Notification sent via SSE",
    });
  } catch (error: any) {
    logger.error("❌ Debug notify error:", error);
    return NextResponse.json(
      {
        error: "Failed to send notification",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
