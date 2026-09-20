import { db } from "@/lib/db";
import { deductCredits } from "@/lib/credit-logic";
import { invalidateSubscriptionCache } from "@/lib/cache-invalidation";
import { notifyStatusChange } from "@/lib/notifications";
import { getTranslation } from "@/lib/notifications/i18n-helper";

export interface RevisionResult {
  allowed: boolean;
  isFree: boolean;
  creditCost: number;
  newRevisionCount: number;
  message: string;
}

/**
 * Smart Revision Algorithm (atomic)
 *
 * Free path: CAS update only while status=DELIVERED and count < max.
 * Paid path: deduct credits + status/counter update in one $transaction.
 * Concurrent revision requests cannot exceed free allowance or double-charge.
 */
export async function handleRevisionRequest(
  requestId: string,
  userId: string,
  locale = "en"
): Promise<RevisionResult> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    include: {
      client: true,
      serviceType: true,
    },
  });

  if (!request || request.deletedAt) {
    return {
      allowed: false,
      isFree: false,
      creditCost: 0,
      newRevisionCount: 0,
      message: "Request not found.",
    };
  }

  if (request.clientId !== userId) {
    return {
      allowed: false,
      isFree: false,
      creditCost: 0,
      newRevisionCount: 0,
      message: "Only the request owner can request revisions.",
    };
  }

  if (request.status !== "DELIVERED") {
    return {
      allowed: false,
      isFree: false,
      creditCost: 0,
      newRevisionCount: request.currentRevisionCount,
      message: "Revisions can only be requested for delivered work.",
    };
  }

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
      allowed: false,
      isFree: false,
      creditCost: 0,
      newRevisionCount: request.currentRevisionCount,
      message: "No active subscription. Please subscribe to request revisions.",
    };
  }

  const maxFreeRevisions = request.serviceType.maxFreeRevisions;
  const currentCount = request.currentRevisionCount;
  const paidRevisionCost = request.serviceType.paidRevisionCost;
  const resetFreeRevisionsOnPaid = request.serviceType.resetFreeRevisionsOnPaid;

  // FREE REVISION — conditional update prevents concurrent over-allowance
  if (currentCount < maxFreeRevisions) {
    const freeRevisionComment = await getTranslation(
      locale,
      "requests.messages.systemMessages.revisionRequestedFree",
      {
        used: currentCount + 1,
        max: maxFreeRevisions,
      }
    );

    const result = await db.$transaction(async (tx) => {
      const cas = await tx.request.updateMany({
        where: {
          id: requestId,
          deletedAt: null,
          status: "DELIVERED",
          currentRevisionCount: { lt: maxFreeRevisions },
        },
        data: {
          currentRevisionCount: { increment: 1 },
          totalRevisions: { increment: 1 },
          status: "REVISION_REQUESTED",
          isRevision: true,
          revisionType: "free",
          needsManualApproval: false,
          approvalReminderSentAt: null,
        },
      });

      if (cas.count === 0) {
        return null;
      }

      await tx.requestComment.create({
        data: {
          requestId,
          userId,
          content: freeRevisionComment,
          type: "SYSTEM",
        },
      });

      return tx.request.findUnique({ where: { id: requestId } });
    });

    if (!result) {
      return {
        allowed: false,
        isFree: false,
        creditCost: 0,
        newRevisionCount: currentCount,
        message: "Unable to request revision. The request may have changed — please refresh.",
      };
    }

    if (request.providerId) {
      await notifyStatusChange({
        requestId,
        userId: request.providerId,
        oldStatus: "DELIVERED",
        newStatus: "REVISION_REQUESTED",
        locale,
      });
    }

    return {
      allowed: true,
      isFree: true,
      creditCost: 0,
      newRevisionCount: result.currentRevisionCount,
      message: `Free revision requested (${result.currentRevisionCount}/${maxFreeRevisions} used). Provider will be notified.`,
    };
  }

  // PAID REVISION — deduct + update in one transaction
  if (subscription.remainingCredits < paidRevisionCost) {
    return {
      allowed: false,
      isFree: false,
      creditCost: paidRevisionCost,
      newRevisionCount: currentCount,
      message: `You've used all ${maxFreeRevisions} free revisions. Additional revisions cost ${paidRevisionCost} ${paidRevisionCost === 1 ? "credit" : "credits"}, but you have ${subscription.remainingCredits} credits remaining. Please purchase more credits.`,
    };
  }

  const resetNote = await getTranslation(
    locale,
    resetFreeRevisionsOnPaid
      ? "requests.messages.systemMessages.revisionPaidCounterReset"
      : "requests.messages.systemMessages.revisionPaidCounterNotReset",
    resetFreeRevisionsOnPaid ? { max: maxFreeRevisions } : undefined
  );

  const creditUnit = await getTranslation(
    locale,
    paidRevisionCost === 1 ? "requests.header.credit" : "requests.header.credits"
  );

  const paidRevisionComment = await getTranslation(
    locale,
    "requests.messages.systemMessages.revisionRequestedPaid",
    {
      cost: paidRevisionCost,
      creditUnit,
      resetNote,
    }
  );

  const paidResult = await db.$transaction(async (tx) => {
    const deductResult = await deductCredits(
      userId,
      paidRevisionCost,
      `Paid revision for request: ${request.title}`,
      tx
    );

    if (!deductResult.success) {
      return { ok: false as const, message: deductResult.message || "Failed to deduct credits." };
    }

    const newRevisionCount = resetFreeRevisionsOnPaid ? 0 : currentCount;
    const cas = await tx.request.updateMany({
      where: {
        id: requestId,
        deletedAt: null,
        status: "DELIVERED",
        currentRevisionCount: { gte: maxFreeRevisions },
      },
      data: {
        currentRevisionCount: newRevisionCount,
        totalRevisions: { increment: 1 },
        status: "REVISION_REQUESTED",
        isRevision: true,
        revisionType: "paid",
        creditCost: { increment: paidRevisionCost },
        needsManualApproval: false,
        approvalReminderSentAt: null,
      },
    });

    if (cas.count === 0) {
      // Throw to roll back the credit deduction
      throw new Error("REVISION_STATUS_CHANGED");
    }

    await tx.requestComment.create({
      data: {
        requestId,
        userId,
        content: paidRevisionComment,
        type: "SYSTEM",
      },
    });

    const updated = await tx.request.findUnique({ where: { id: requestId } });
    return {
      ok: true as const,
      newBalance: deductResult.newBalance,
      newRevisionCount: updated?.currentRevisionCount ?? newRevisionCount,
    };
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "REVISION_STATUS_CHANGED") {
      return {
        ok: false as const,
        message: "Unable to request revision. The request may have changed — please refresh.",
      };
    }
    throw err;
  });

  if (!paidResult.ok) {
    return {
      allowed: false,
      isFree: false,
      creditCost: paidRevisionCost,
      newRevisionCount: currentCount,
      message: paidResult.message,
    };
  }

  await invalidateSubscriptionCache(userId);

  if (request.providerId) {
    await notifyStatusChange({
      requestId,
      userId: request.providerId,
      oldStatus: "DELIVERED",
      newStatus: "REVISION_REQUESTED",
      locale,
    });
  }

  return {
    allowed: true,
    isFree: false,
    creditCost: paidRevisionCost,
    newRevisionCount: paidResult.newRevisionCount,
    message: buildPaidRevisionMessage(
      paidRevisionCost,
      maxFreeRevisions,
      resetFreeRevisionsOnPaid,
      paidResult.newBalance
    ),
  };
}

function buildPaidRevisionMessage(
  cost: number,
  maxFree: number,
  reset: boolean,
  balance: number
): string {
  const creditText = cost === 1 ? "credit" : "credits";
  const baseMessage = `Paid revision requested (${cost} ${creditText} deducted).`;

  if (reset) {
    return `${baseMessage} Your free revision counter has been reset - you now have ${maxFree} free revisions available again. Credits remaining: ${balance}`;
  }

  return `${baseMessage} Note: Free revision counter was NOT reset. Credits remaining: ${balance}`;
}

/**
 * Get revision info for a request
 */
export async function getRevisionInfo(
  requestId: string,
  userId: string
): Promise<{
  currentCount: number;
  maxFree: number;
  totalRevisions: number;
  nextRevisionCost: number;
  freeRevisionsRemaining: number;
}> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    include: {
      serviceType: true,
    },
  });

  if (!request || request.deletedAt || request.clientId !== userId) {
    return {
      currentCount: 0,
      maxFree: 0,
      totalRevisions: 0,
      nextRevisionCost: 0,
      freeRevisionsRemaining: 0,
    };
  }

  const maxFree = request.serviceType.maxFreeRevisions;
  const paidCost = request.serviceType.paidRevisionCost;
  const currentCount = request.currentRevisionCount;
  const freeRevisionsRemaining = Math.max(0, maxFree - currentCount);
  const nextRevisionCost = freeRevisionsRemaining > 0 ? 0 : paidCost;

  return {
    currentCount,
    maxFree,
    totalRevisions: request.totalRevisions,
    nextRevisionCost,
    freeRevisionsRemaining,
  };
}

/**
 * Check if revision request would be free
 */
export async function isRevisionFree(requestId: string, userId: string): Promise<boolean> {
  const info = await getRevisionInfo(requestId, userId);
  return info.freeRevisionsRemaining > 0;
}
