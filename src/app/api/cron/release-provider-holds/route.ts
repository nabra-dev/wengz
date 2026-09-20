import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { releaseDueHeldEarnings } from "@/lib/provider-wallet";
import { logger } from "@/lib/logger";
import { logActivityAsync } from "@/lib/activity-log";

// Call every ~1 hour via an external scheduler (GitHub Actions, host cron, etc.)
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[CRON] CRON_SECRET is not set — refusing to run in production");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = await releaseDueHeldEarnings(db, { now });

    logActivityAsync({
      action: "cron.releaseProviderHolds",
      message: `Cron released provider earnings holds: ${results.released} of ${results.scanned} due`,
      metadata: { ...results },
      level: "info",
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    logger.error("[CRON] release-provider-holds failed:", error);
    logActivityAsync({
      action: "cron.releaseProviderHolds",
      message: "Cron provider-hold release failed",
      level: "error",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
