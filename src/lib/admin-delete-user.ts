import type { PrismaClient, Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { isSuperAdmin } from "@/lib/roles";
import { invalidateSessionUserCache } from "@/lib/session-user-cache";
import { sendAccountDeletedEmail } from "@/lib/notifications";

/** Request statuses that are still in flight (not completed/cancelled). */
export const OPEN_REQUEST_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION_REQUESTED",
] as const;

export type UserDeleteImpact = {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  alreadyDeleted: boolean;
  openClientRequests: number;
  openProviderRequests: number;
  totalClientRequests: number;
  totalProviderRequests: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  totalSubscriptions: number;
  pendingPaymentProofs: number;
  pendingWithdrawals: number;
  openFinanceDisputes: number;
};

type Db = PrismaClient;

function deletedEmailFor(userId: string): string {
  return `deleted_${userId}@deleted.com`;
}

export async function getUserDeleteImpact(db: Db, userId: string): Promise<UserDeleteImpact> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deletedAt: true,
    },
  });

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  const [
    openClientRequests,
    openProviderRequests,
    totalClientRequests,
    totalProviderRequests,
    activeSubscriptions,
    pendingSubscriptions,
    totalSubscriptions,
    pendingPaymentProofs,
    pendingWithdrawals,
    openFinanceDisputes,
  ] = await Promise.all([
    db.request.count({
      where: {
        clientId: userId,
        deletedAt: null,
        status: { in: [...OPEN_REQUEST_STATUSES] },
      },
    }),
    db.request.count({
      where: {
        providerId: userId,
        deletedAt: null,
        status: { in: [...OPEN_REQUEST_STATUSES] },
      },
    }),
    db.request.count({ where: { clientId: userId } }),
    db.request.count({ where: { providerId: userId } }),
    db.clientSubscription.count({
      where: { userId, isActive: true, cancelledAt: null },
    }),
    db.clientSubscription.count({
      where: { userId, isActive: false, cancelledAt: null },
    }),
    db.clientSubscription.count({ where: { userId } }),
    db.paymentProof.count({
      where: { userId, status: "PENDING" },
    }),
    db.withdrawalRequest.count({
      where: { providerId: userId, status: "PENDING" },
    }),
    db.providerFinanceDispute.count({
      where: {
        providerId: userId,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
    }),
  ]);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    alreadyDeleted: Boolean(user.deletedAt),
    openClientRequests,
    openProviderRequests,
    totalClientRequests,
    totalProviderRequests,
    activeSubscriptions,
    pendingSubscriptions,
    totalSubscriptions,
    pendingPaymentProofs,
    pendingWithdrawals,
    openFinanceDisputes,
  };
}

export type AdminDeleteUserResult = {
  success: true;
  userId: string;
  previousEmail: string;
  impact: UserDeleteImpact;
  cancelledOpenClientRequests: number;
  cancelledOpenProviderRequests: number;
  cancelledSubscriptions: number;
  rejectedPaymentProofs: number;
  rejectedWithdrawals: number;
};

/**
 * Soft-delete a user for admin/PM.
 * Keeps history (requests, subscriptions, wallet) — no hard delete.
 * Frees the email for re-registration and cancels in-flight work.
 */
export async function adminDeleteUser(params: {
  db: Db;
  userId: string;
  actorId: string;
  locale: string;
}): Promise<AdminDeleteUserResult> {
  const { db, userId, actorId, locale } = params;

  if (userId === actorId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You cannot delete your own account from admin. Use profile settings instead.",
    });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deletedAt: true,
    },
  });

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  if (isSuperAdmin(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Super admin accounts cannot be deleted",
    });
  }

  const impact = await getUserDeleteImpact(db, userId);
  const previousEmail = user.email;
  const tombstoneEmail = deletedEmailFor(userId);

  // Already fully tombstoned — treat as success (idempotent).
  if (user.deletedAt && user.email === tombstoneEmail) {
    return {
      success: true,
      userId,
      previousEmail,
      impact,
      cancelledOpenClientRequests: 0,
      cancelledOpenProviderRequests: 0,
      cancelledSubscriptions: 0,
      rejectedPaymentProofs: 0,
      rejectedWithdrawals: 0,
    };
  }

  // Notify on the real email before rewrite (best-effort).
  if (!previousEmail.startsWith("deleted_") || !previousEmail.endsWith("@deleted.com")) {
    await sendAccountDeletedEmail({
      userEmail: previousEmail,
      userName: user.name || previousEmail,
      locale,
    }).catch(() => undefined);
  }

  const now = new Date();
  const deleteReason = "Account deleted by admin";

  const result = await db.$transaction(async (tx) => {
    const cancelledClient = await tx.request.updateMany({
      where: {
        clientId: userId,
        deletedAt: null,
        status: { in: [...OPEN_REQUEST_STATUSES] },
      },
      data: {
        deletedAt: now,
        status: "CANCELLED",
      },
    });

    const cancelledProvider = await tx.request.updateMany({
      where: {
        providerId: userId,
        deletedAt: null,
        status: { in: [...OPEN_REQUEST_STATUSES] },
      },
      data: {
        deletedAt: now,
        status: "CANCELLED",
      },
    });

    const cancelledSubs = await tx.clientSubscription.updateMany({
      where: {
        userId,
        cancelledAt: null,
      },
      data: {
        isActive: false,
        cancelledAt: now,
      },
    });

    const rejectedProofs = await tx.paymentProof.updateMany({
      where: { userId, status: "PENDING" },
      data: {
        status: "REJECTED",
        rejectionReason: deleteReason,
        reviewedBy: actorId,
        reviewedAt: now,
      },
    });

    const rejectedWithdrawals = await tx.withdrawalRequest.updateMany({
      where: { providerId: userId, status: "PENDING" },
      data: {
        status: "REJECTED",
        adminReason: deleteReason,
        reviewedById: actorId,
        reviewedAt: now,
      },
    });

    // Close open finance disputes so they do not stay actionable on a deleted creator.
    await tx.providerFinanceDispute.updateMany({
      where: {
        providerId: userId,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
      data: {
        status: "REJECTED",
        adminNote: deleteReason,
        reviewedById: actorId,
        reviewedAt: now,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        email: tombstoneEmail,
        sessions: { deleteMany: {} },
        accounts: { deleteMany: {} },
      },
    });

    return {
      cancelledOpenClientRequests: cancelledClient.count,
      cancelledOpenProviderRequests: cancelledProvider.count,
      cancelledSubscriptions: cancelledSubs.count,
      rejectedPaymentProofs: rejectedProofs.count,
      rejectedWithdrawals: rejectedWithdrawals.count,
    };
  });

  await invalidateSessionUserCache(userId);

  return {
    success: true,
    userId,
    previousEmail,
    impact,
    ...result,
  };
}
