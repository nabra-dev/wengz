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

const EXPIRING_TITLE = "⚠️ Subscription Expiring Soon";
const EXPIRED_TITLE = "❌ Subscription Expired";
const BATCH_SIZE = 200;

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
    // Narrow window: roughly "day 7" (6.5–7.5 days out) so we don't scan a full week of rows.
    const day7Start = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);
    const day7End = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [expiringSubscriptions, expiredSubscriptions] = await Promise.all([
      db.clientSubscription.findMany({
        where: {
          isActive: true,
          endDate: { gte: day7Start, lte: day7End },
        },
        take: BATCH_SIZE,
        include: {
          package: {
            select: { name: true, nameI18n: true },
          },
        },
      }),
      db.clientSubscription.findMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        take: BATCH_SIZE,
        include: {
          package: {
            select: { name: true, nameI18n: true },
          },
        },
      }),
    ]);

    const results: NotificationResults = {
      expiringNotified: 0,
      expiredNotified: 0,
      expiredDeactivated: 0,
      errors: [],
    };

    const expiringUserIds = expiringSubscriptions.map((s) => s.userId);
    const expiredUserIds = expiredSubscriptions.map((s) => s.userId);
    const allUserIds = [...new Set([...expiringUserIds, ...expiredUserIds])];

    const recentNotifications =
      allUserIds.length === 0
        ? []
        : await db.notification.findMany({
            where: {
              userId: { in: allUserIds },
              title: { in: [EXPIRING_TITLE, EXPIRED_TITLE] },
              createdAt: { gte: oneWeekAgo },
            },
            select: { userId: true, title: true },
          });

    const notifiedKeys = new Set(recentNotifications.map((n) => `${n.userId}:${n.title}`));

    for (const subscription of expiringSubscriptions) {
      try {
        const key = `${subscription.userId}:${EXPIRING_TITLE}`;
        if (notifiedKeys.has(key)) continue;

        const daysRemaining = Math.ceil(
          (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await notifySubscriptionExpiring({
          userId: subscription.userId,
          packageName: subscription.package.name,
          packageNameI18n: subscription.package.nameI18n as Record<string, string> | null,
          daysRemaining,
          remainingCredits: subscription.remainingCredits,
        });
        notifiedKeys.add(key);
        results.expiringNotified++;
      } catch (error) {
        logger.error(`Failed to notify user ${subscription.userId}:`, error);
        results.errors.push(`User ${subscription.userId}: ${error}`);
      }
    }

    // Batch-deactivate all expired in this page first
    if (expiredSubscriptions.length > 0) {
      const deactivate = await db.clientSubscription.updateMany({
        where: {
          id: { in: expiredSubscriptions.map((s) => s.id) },
          isActive: true,
        },
        data: { isActive: false },
      });
      results.expiredDeactivated = deactivate.count;
    }

    for (const subscription of expiredSubscriptions) {
      try {
        const key = `${subscription.userId}:${EXPIRED_TITLE}`;
        if (notifiedKeys.has(key)) continue;

        await notifySubscriptionExpired({
          userId: subscription.userId,
          packageName: subscription.package.name,
          packageNameI18n: subscription.package.nameI18n as Record<string, string> | null,
        });
        notifiedKeys.add(key);
        results.expiredNotified++;
      } catch (error) {
        logger.error(`Failed to process expired subscription ${subscription.id}:`, error);
        results.errors.push(`Subscription ${subscription.id}: ${error}`);
      }
    }

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
