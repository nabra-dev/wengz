import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { releaseDueHeldEarnings } from "@/lib/provider-wallet";
import { notifyProviderEarningsHoldReleased } from "@/lib/notifications";
import { getPreferredLocalesByUserIds } from "@/lib/user-locale";
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

    const locales = await getPreferredLocalesByUserIds(
      results.items.map((item) => item.providerId)
    );

    for (const item of results.items) {
      try {
        await notifyProviderEarningsHoldReleased({
          providerId: item.providerId,
          amountUsd: item.amountUsd,
          locale: locales.get(item.providerId) ?? "en",
        });
      } catch (error) {
        logger.error(`[CRON] Failed hold-release notify for provider ${item.providerId}:`, error);
      }
    }

    logActivityAsync({
      action: "cron.releaseProviderHolds",
      message: `Cron released provider earnings holds: ${results.released} of ${results.scanned} due`,
      metadata: {
        released: results.released,
        scanned: results.scanned,
        notifiedProviders: results.items.length,
      },
      level: "info",
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results: {
        released: results.released,
        scanned: results.scanned,
        notifiedProviders: results.items.length,
      },
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
