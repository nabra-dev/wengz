import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

type TransactionClient = Prisma.TransactionClient;

const ACTIVE_DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW"] as const;

export async function openProviderFinanceDispute(
  tx: TransactionClient,
  params: {
    providerId: string;
    reason: string;
    ledgerId?: string | null;
    withdrawalId?: string | null;
  }
) {
  const reason = params.reason.trim();
  if (!reason) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please describe the problem",
    });
  }

  const ledgerId = params.ledgerId?.trim() || null;
  const withdrawalId = params.withdrawalId?.trim() || null;

  if ((!ledgerId && !withdrawalId) || (ledgerId && withdrawalId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Dispute must target exactly one ledger entry or withdrawal",
    });
  }

  if (ledgerId) {
    const ledger = await tx.providerFinanceLedger.findFirst({
      where: { id: ledgerId, providerId: params.providerId },
      select: { id: true },
    });
    if (!ledger) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ledger entry not found",
      });
    }

    const existing = await tx.providerFinanceDispute.findFirst({
      where: {
        ledgerId,
        status: { in: [...ACTIVE_DISPUTE_STATUSES] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This ledger entry already has an open dispute",
      });
    }
  }

  if (withdrawalId) {
    const withdrawal = await tx.withdrawalRequest.findFirst({
      where: { id: withdrawalId, providerId: params.providerId },
      select: { id: true },
    });
    if (!withdrawal) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Withdrawal not found",
      });
    }

    const existing = await tx.providerFinanceDispute.findFirst({
      where: {
        withdrawalId,
        status: { in: [...ACTIVE_DISPUTE_STATUSES] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This withdrawal already has an open dispute",
      });
    }
  }

  return tx.providerFinanceDispute.create({
    data: {
      providerId: params.providerId,
      ledgerId,
      withdrawalId,
      reason,
      status: "OPEN",
    },
  });
}

export async function reviewProviderFinanceDispute(
  tx: TransactionClient,
  params: {
    disputeId: string;
    adminId: string;
    status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
    adminNote: string;
  }
) {
  const adminNote = params.adminNote.trim();
  if (!adminNote) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please provide a note",
    });
  }

  const dispute = await tx.providerFinanceDispute.findUnique({
    where: { id: params.disputeId },
  });

  if (!dispute) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Dispute not found",
    });
  }

  if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This dispute has already been closed",
    });
  }

  return tx.providerFinanceDispute.update({
    where: { id: dispute.id },
    data: {
      status: params.status,
      adminNote,
      reviewedById: params.adminId,
      reviewedAt: new Date(),
    },
  });
}
