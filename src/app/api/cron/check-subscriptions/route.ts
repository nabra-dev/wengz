import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifySubscriptionExpiring, notifySubscriptionExpired } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { logActivityAsync } from "@/lib/activity-log";

// This endpoint should be called by a cron job (e.g., daily via GitHub Actions or an external scheduler)
export const dynamic = "force-dynamic";

interface NotificationResults {
  expiringNotified: number;
  expiredNotified: number;
  expiredDeactivated: number;
  errors: string[];
}

async function checkForExistingNotification(
  userId: string,
  title: string,
  since: Date
): Promise<boolean> {
  const notification = await db.notification.findFirst({
    where: {
      userId,
      title,
      createdAt: { gte: since },
    },
  });
  return !!notification;
}

async function processExpiringSubscriptions(
  subscriptions: any[],
  now: Date,
  results: NotificationResults
) {
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const subscription of subscriptions) {
    try {
      const nowTime = now.getTime();
      const daysRemaining = Math.ceil(
        (subscription.endDate.getTime() - nowTime) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining !== 7) continue;

      const alreadyNotified = await checkForExistingNotification(
        subscription.userId,
        "⚠️ Subscription Expiring Soon",
        oneWeekAgo
      );

      if (!alreadyNotified) {
        await notifySubscriptionExpiring({
          userId: subscription.userId,
          packageName: subscription.package.name,
          packageNameI18n: subscription.package.nameI18n as Record<string, string> | null,
          daysRemaining,
          remainingCredits: subscription.remainingCredits,
        });
        results.expiringNotified++;
      }
    } catch (error) {
      logger.error(`Failed to notify user ${subscription.userId}:`, error);
      results.errors.push(`User ${subscription.userId}: ${error}`);
    }
  }
}

async function processExpiredSubscriptions(
  subscriptions: any[],
  now: Date,
  results: NotificationResults
) {
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const subscription of subscriptions) {
    try {
      const alreadyNotified = await checkForExistingNotification(
        subscription.userId,
        "❌ Subscription Expired",
        oneWeekAgo
      );

      if (!alreadyNotified) {
        await notifySubscriptionExpired({
          userId: subscription.userId,
          packageName: subscription.package.name,
          packageNameI18n: subscription.package.nameI18n as Record<string, string> | null,
        });
        results.expiredNotified++;
      }

      // Deactivate the expired subscription
      await db.clientSubscription.update({
        where: { id: subscription.id },
        data: { isActive: false },
      });
      results.expiredDeactivated++;
    } catch (error) {
      logger.error(`Failed to process expired subscription ${subscription.id}:`, error);
      results.errors.push(`Subscription ${subscription.id}: ${error}`);
    }
  }
}

export async function GET(request: Request) {
  // Fail closed: CRON_SECRET is required in production. In development we
  // allow unauthenticated calls to keep local testing simple.
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
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find subscriptions expiring in 7 days
    const expiringSubscriptions = await db.clientSubscription.findMany({
      where: {
        isActive: true,
        endDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        package: {
          select: {
            name: true,
            nameI18n: true,
          },
        },
      },
    });

    // Find expired subscriptions (that are still marked as active)
    const expiredSubscriptions = await db.clientSubscription.findMany({
      where: {
        isActive: true,
        endDate: {
          lt: now,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        package: {
          select: {
            name: true,
            nameI18n: true,
          },
        },
      },
    });

    const results: NotificationResults = {
      expiringNotified: 0,
      expiredNotified: 0,
      expiredDeactivated: 0,
      errors: [],
    };

    await processExpiringSubscriptions(expiringSubscriptions, now, results);
    await processExpiredSubscriptions(expiredSubscriptions, now, results);

    logActivityAsync({
      action: "cron.subscriptions",
      message: `Cron checked subscriptions: ${results.expiringNotified} expiring, ${results.expiredNotified} expired, ${results.expiredDeactivated} deactivated`,
      metadata: { ...results },
      level: results.errors.length ? "warn" : "info",
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
      message: `Checked subscriptions: ${results.expiringNotified} expiring notifications sent, ${results.expiredNotified} expired notifications sent, ${results.expiredDeactivated} subscriptions deactivated.`,
    });
  } catch (error) {
    logger.error("Error checking subscriptions:", error);
    logActivityAsync({
      action: "cron.subscriptions",
      message: "Cron subscription check failed",
      level: "error",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check subscriptions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
