import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

export type ActivityAction =
  | "auth.register"
  | "auth.login_failed"
  | "credit.deduct"
  | "credit.add"
  | "request.create"
  | "request.claim"
  | "request.accept"
  | "request.status"
  | "request.approve"
  | "request.revision"
  | "payment.submit"
  | "payment.approve"
  | "payment.reject"
  | "wallet.withdraw_request"
  | "wallet.withdraw_review"
  | "wallet.payout"
  | "wallet.settle"
  | "admin.user_update"
  | "cron.subscriptions"
  | "system.error";

export type ActivityLevel = "info" | "warn" | "error";

type LogActivityInput = {
  action: ActivityAction | string;
  message: string;
  actorId?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  level?: ActivityLevel;
  ip?: string | null;
};

/**
 * Persist an immutable activity row for in-app history.
 * Fire-and-forget safe: failures are logged but never throw to callers.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        action: input.action,
        message: input.message,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        level: input.level ?? "info",
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    logger.error("Failed to write activity log", {
      error: error instanceof Error ? error : undefined,
      action: input.action,
    });
  }
}

/** Non-blocking wrapper for call sites that must not await DB. */
export function logActivityAsync(input: LogActivityInput): void {
  void logActivity(input);
}
