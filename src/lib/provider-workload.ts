import { db } from "@/lib/db";

export type ProviderWorkload = {
  inProgressCount: number;
  revisionCount: number;
  totalActive: number;
};

/**
 * Active work slots = IN_PROGRESS + REVISION_REQUESTED only.
 * DELIVERED and assigned PENDING do not consume a slot.
 */
export async function getProviderWorkload(providerId: string): Promise<ProviderWorkload> {
  const [inProgressCount, revisionCount] = await Promise.all([
    db.request.count({
      where: {
        providerId,
        deletedAt: null,
        status: "IN_PROGRESS",
      },
    }),
    db.request.count({
      where: {
        providerId,
        deletedAt: null,
        status: "REVISION_REQUESTED",
      },
    }),
  ]);

  return {
    inProgressCount,
    revisionCount,
    totalActive: inProgressCount + revisionCount,
  };
}

/**
 * Whether the provider may start (or accept into) a new IN_PROGRESS job.
 *
 * Rules:
 * - Max 1 active job normally (IN_PROGRESS or REVISION_REQUESTED).
 * - If they have ≥1 REVISION_REQUESTED and 0 IN_PROGRESS, they may start one additional IN_PROGRESS.
 * - They may always continue work on a request they already hold in REVISION_REQUESTED (deliver path).
 */
export function canStartNewInProgressWork(workload: ProviderWorkload): boolean {
  if (workload.inProgressCount >= 1) {
    return false;
  }
  if (workload.revisionCount >= 1) {
    return true;
  }
  return workload.totalActive === 0;
}

/**
 * Whether the provider may claim a PENDING request (light anti-hoarding while mid-work).
 * Allowed when they have capacity for a future start under Option A rules.
 */
export function canClaimAdditionalRequest(workload: ProviderWorkload): boolean {
  return canStartNewInProgressWork(workload);
}

export const PROVIDER_AT_CAPACITY_MESSAGE =
  "You can only work on one request at a time. Deliver your current work first, or finish a revision before starting another.";
