import type { PrismaClient } from "@prisma/client";

type FreeClientSubscriptionDb = Pick<PrismaClient, "package" | "clientSubscription" | "user">;

/**
 * Assigns the free trial package to a new client once.
 * Enforces isFreeTrialUsed: never grant another free trial to a user who
 * already consumed one (including soft-deleted subscription history).
 */
export async function assignFreeClientSubscription(db: FreeClientSubscriptionDb, userId: string) {
  const alreadyUsed = await db.clientSubscription.findFirst({
    where: {
      userId,
      isFreeTrialUsed: true,
    },
    select: { id: true },
  });

  if (alreadyUsed) {
    return null;
  }

  const freePackage = await db.package.findFirst({
    where: {
      isFreePackage: true,
      isActive: true,
    },
  });

  if (!freePackage) {
    return null;
  }

  const now = new Date();
  const endDate = new Date(Date.now() + freePackage.durationDays * 24 * 60 * 60 * 1000);

  return db.clientSubscription.create({
    data: {
      userId,
      packageId: freePackage.id,
      remainingCredits: freePackage.credits,
      startDate: now,
      endDate,
      isActive: true,
      isFreeTrialUsed: true,
    },
  });
}
