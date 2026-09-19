import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyApprovalReminder } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { logActivityAsync } from "@/lib/activity-log";

// Call every ~15 minutes via an external scheduler (GitHub Actions, host cron, etc.)
export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

interface ApprovalCronResults {
  remindersSent: number;
  flaggedManualApproval: number;
  errors: string[];
}

async function processApprovalReminders(now: Date, results: ApprovalCronResults) {
  const oneHourAgo = new Date(now.getTime() - ONE_HOUR_MS);

  const dueReminders = await db.request.findMany({
    where: {
      status: "DELIVERED",
      deletedAt: null,
      deliveredAt: { lte: oneHourAgo, not: null },
      approvalReminderSentAt: null,
    },
    select: {
      id: true,
      clientId: true,
    },
    take: 200,
  });

  for (const request of dueReminders) {
    try {
      // CAS: only mark once so concurrent cron runs do not double-email
      const claimed = await db.request.updateMany({
        where: {
          id: request.id,
          status: "DELIVERED",
          deletedAt: null,
          approvalReminderSentAt: null,
        },
        data: { approvalReminderSentAt: now },
      });

      if (claimed.count === 0) continue;

      await notifyApprovalReminder({
        requestId: request.id,
        clientId: request.clientId,
        locale: "en",
      });

      results.remindersSent++;
    } catch (error) {
      logger.error(`[CRON] Failed approval reminder for request ${request.id}:`, error);
      results.errors.push(`Reminder ${request.id}: ${error}`);
    }
  }
}

async function processManualApprovalFlags(results: ApprovalCronResults) {
  const twelveHoursAgo = new Date(Date.now() - TWELVE_HOURS_MS);

  const flagged = await db.request.updateMany({
    where: {
      status: "DELIVERED",
      deletedAt: null,
      deliveredAt: { lte: twelveHoursAgo, not: null },
      needsManualApproval: false,
    },
    data: { needsManualApproval: true },
  });

  results.flaggedManualApproval = flagged.count;
}

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
    const results: ApprovalCronResults = {
      remindersSent: 0,
      flaggedManualApproval: 0,
      errors: [],
    };

    await processApprovalReminders(now, results);
    await processManualApprovalFlags(results);

    logActivityAsync({
      action: "cron.deliveredApprovals",
      message: `Cron checked delivered approvals: ${results.remindersSent} reminders, ${results.flaggedManualApproval} flagged for manual approval`,
      metadata: { ...results },
      level: results.errors.length ? "warn" : "info",
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    logger.error("[CRON] check-delivered-approvals failed:", error);
    logActivityAsync({
      action: "cron.deliveredApprovals",
      message: "Cron delivered-approvals check failed",
      level: "error",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
