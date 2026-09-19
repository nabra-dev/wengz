import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { logActivityAsync } from "@/lib/activity-log";

/** Prisma client or an interactive transaction client. */
type DbLike = Prisma.TransactionClient | typeof db;

export interface CreditCheckResult {
  allowed: boolean;
  remainingCredits: number;
  message?: string;
}

export interface CreditDeductionResult {
  success: boolean;
  newBalance: number;
  message?: string;
}

/**
 * Check if user has enough credits for an operation
 */
export async function checkCredits(
  userId: string,
  requiredCredits: number = 1
): Promise<CreditCheckResult> {
  const subscription = await db.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      allowed: false,
      remainingCredits: 0,
      message: "No active subscription found. Please subscribe to a package.",
    };
  }

  if (subscription.remainingCredits < requiredCredits) {
    return {
      allowed: false,
      remainingCredits: subscription.remainingCredits,
      message: `Insufficient credits. You have ${subscription.remainingCredits} credits but need ${requiredCredits}.`,
    };
  }

  return {
    allowed: true,
    remainingCredits: subscription.remainingCredits,
  };
}

/**
 * Deduct credits from user's subscription.
 *
 * Atomic: the balance guard is evaluated inside the UPDATE itself
 * (`WHERE remainingCredits >= credits` + `decrement`), so concurrent
 * deductions cannot double-spend. Pass `tx` to participate in a caller's
 * transaction (e.g. deduct + request create must commit or roll back
 * together).
 */
export async function deductCredits(
  userId: string,
  credits: number = 1,
  reason?: string,
  tx?: DbLike
): Promise<CreditDeductionResult> {
  const client = tx ?? db;

  const subscription = await client.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      success: false,
      newBalance: 0,
      message: "No active subscription found.",
    };
  }

  const result = await client.clientSubscription.updateMany({
    where: {
      id: subscription.id,
      isActive: true,
      endDate: { gte: new Date() },
      remainingCredits: { gte: credits },
    },
    data: { remainingCredits: { decrement: credits } },
  });

  if (result.count === 0) {
    return {
      success: false,
      newBalance: subscription.remainingCredits,
      message: "Insufficient credits.",
    };
  }

  // Log the transaction (optional - could create a CreditTransaction table)
  logger.info("Credits deducted", { userId, credits, reason });
  logActivityAsync({
    action: "credit.deduct",
    message: `Deducted ${credits} credit(s)${reason ? `: ${reason}` : ""}`,
    actorId: userId,
    entityType: "ClientSubscription",
    entityId: subscription.id,
    metadata: { credits, reason, newBalance: subscription.remainingCredits - credits },
  });

  return {
    success: true,
    newBalance: subscription.remainingCredits - credits,
    message: `Successfully deducted ${credits} credit(s).`,
  };
}

/**
 * Combined check and deduct credits in a single operation.
 * Atomic — see `deductCredits`. Pass `tx` to run inside a transaction.
 */
export async function checkAndDeductCredits(
  userId: string,
  credits: number = 1,
  reason?: string,
  tx?: DbLike
): Promise<CreditDeductionResult & { allowed: boolean }> {
  const client = tx ?? db;

  const subscription = await client.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      success: false,
      allowed: false,
      newBalance: 0,
      message: "No active subscription found. Please subscribe to a package.",
    };
  }

  const result = await client.clientSubscription.updateMany({
    where: {
      id: subscription.id,
      isActive: true,
      endDate: { gte: new Date() },
      remainingCredits: { gte: credits },
    },
    data: { remainingCredits: { decrement: credits } },
  });

  if (result.count === 0) {
    return {
      success: false,
      allowed: false,
      newBalance: subscription.remainingCredits,
      message: `Insufficient credits. You have ${subscription.remainingCredits} credits but need ${credits}.`,
    };
  }

  logger.info("Credits deducted", { userId, credits, reason });
  logActivityAsync({
    action: "credit.deduct",
    message: `Deducted ${credits} credit(s)${reason ? `: ${reason}` : ""}`,
    actorId: userId,
    entityType: "ClientSubscription",
    entityId: subscription.id,
    metadata: { credits, reason, newBalance: subscription.remainingCredits - credits },
  });

  return {
    success: true,
    allowed: true,
    newBalance: subscription.remainingCredits - credits,
    message: `Successfully deducted ${credits} credit(s).`,
  };
}

/**
 * Add credits to user's subscription (e.g., for refunds or bonuses).
 * Uses an atomic increment so concurrent additions cannot be lost.
 */
export async function addCredits(
  userId: string,
  credits: number,
  reason?: string,
  tx?: DbLike
): Promise<CreditDeductionResult> {
  const client = tx ?? db;

  const subscription = await client.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      success: false,
      newBalance: 0,
      message: "No active subscription found.",
    };
  }

  const updatedSubscription = await client.clientSubscription.update({
    where: { id: subscription.id },
    data: {
      remainingCredits: { increment: credits },
    },
  });

  logger.info("Credits added", { userId, credits, reason });
  logActivityAsync({
    action: "credit.add",
    message: `Added ${credits} credit(s)${reason ? `: ${reason}` : ""}`,
    actorId: userId,
    entityType: "ClientSubscription",
    entityId: subscription.id,
    metadata: { credits, reason, newBalance: updatedSubscription.remainingCredits },
  });

  return {
    success: true,
    newBalance: updatedSubscription.remainingCredits,
    message: `Successfully added ${credits} credit(s).`,
  };
}

/**
 * Get user's current credit balance
 */
export async function getCreditBalance(userId: string): Promise<{
  balance: number;
  subscription: {
    packageName: string;
    endDate: Date;
  } | null;
}> {
  const subscription = await db.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    include: {
      package: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      balance: 0,
      subscription: null,
    };
  }

  return {
    balance: subscription.remainingCredits,
    subscription: {
      packageName: subscription.package.name,
      endDate: subscription.endDate,
    },
  };
}

/**
 * Check if subscription is about to expire (within 7 days)
 */
export async function checkSubscriptionExpiry(userId: string): Promise<{
  isExpiring: boolean;
  daysRemaining: number;
}> {
  const subscription = await db.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return { isExpiring: true, daysRemaining: 0 };
  }

  const now = Date.now();
  const endDate = new Date(subscription.endDate).getTime();
  const diffTime = endDate - now;
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    isExpiring: daysRemaining <= 7,
    daysRemaining: Math.max(0, daysRemaining),
  };
}
