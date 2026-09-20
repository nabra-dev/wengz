import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getFinanceSettings } from "@/lib/finance-settings";

/** Days after client approval before settled earnings become withdrawable. */
export const PROVIDER_EARNINGS_HOLD_DAYS = 7;

export type PayoutMethodValue = "BANK" | "E_WALLET";

export type PayoutDetailsInput = {
  payoutMethod: PayoutMethodValue;
  accountHolder: string;
  bankName?: string | null;
  bankAccount?: string | null;
  eWalletNumber?: string | null;
};

export type NormalizedPayoutDetails = {
  payoutMethod: PayoutMethodValue;
  accountHolder: string;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
};

type TransactionClient = Prisma.TransactionClient;

function roundUsd(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function calculateProviderFinance(
  totalCredits: number,
  creditPriceUsd: number,
  commissionPercent: number
) {
  const normalizedCredits = Math.max(0, Math.floor(totalCredits));
  const normalizedCreditPriceUsd = Math.max(0, creditPriceUsd);
  const normalizedCommissionPercent = Math.min(100, Math.max(0, commissionPercent));

  // Split credits first so wallet credit/USD balances stay aligned (no 4 credits / $4.50 drift).
  const platformCredits = Math.round(normalizedCredits * (normalizedCommissionPercent / 100));
  const providerCredits = normalizedCredits - platformCredits;

  const totalAmountUsd = roundUsd(normalizedCredits * normalizedCreditPriceUsd);
  const platformAmountUsd = roundUsd(platformCredits * normalizedCreditPriceUsd);
  const providerAmountUsd = roundUsd(providerCredits * normalizedCreditPriceUsd);

  return {
    totalCredits: normalizedCredits,
    providerCredits,
    platformCredits,
    creditPriceUsd: normalizedCreditPriceUsd,
    commissionPercent: normalizedCommissionPercent,
    totalAmountUsd,
    platformAmountUsd,
    providerAmountUsd,
  };
}

export async function getOrCreateProviderWallet(tx: TransactionClient, providerId: string) {
  return tx.providerWallet.upsert({
    where: { providerId },
    update: {},
    create: { providerId },
  });
}

export async function settleCompletedRequest(tx: TransactionClient, requestId: string) {
  const existingLedger = await tx.providerFinanceLedger.findUnique({
    where: { requestId },
  });

  if (existingLedger) {
    return existingLedger;
  }

  const request = await tx.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      creditCost: true,
      providerId: true,
      serviceTypeId: true,
    },
  });

  if (!request) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Request not found",
    });
  }

  if (!request.providerId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Cannot settle provider finance without an assigned provider",
    });
  }

  const settings = await getFinanceSettings(tx);
  const finance = calculateProviderFinance(
    request.creditCost,
    settings.creditPriceUsd,
    settings.commissionPercent
  );

  await getOrCreateProviderWallet(tx, request.providerId);

  const settledAt = new Date();
  const availableAt = new Date(
    settledAt.getTime() + PROVIDER_EARNINGS_HOLD_DAYS * 24 * 60 * 60 * 1000
  );

  const ledger = await tx.providerFinanceLedger.create({
    data: {
      requestId,
      providerId: request.providerId,
      serviceTypeId: request.serviceTypeId,
      totalCredits: finance.totalCredits,
      providerCredits: finance.providerCredits,
      platformCredits: finance.platformCredits,
      creditPriceUsd: finance.creditPriceUsd,
      commissionPercent: finance.commissionPercent,
      totalAmountUsd: finance.totalAmountUsd,
      platformAmountUsd: finance.platformAmountUsd,
      providerAmountUsd: finance.providerAmountUsd,
      status: "HOLD",
      settledAt,
      availableAt,
    },
  });

  await tx.providerWallet.update({
    where: { providerId: request.providerId },
    data: {
      heldCredits: {
        increment: finance.providerCredits,
      },
      heldUsd: {
        increment: finance.providerAmountUsd,
      },
    },
  });

  return ledger;
}

/**
 * Move HOLD ledger rows whose availableAt has passed into AVAILABLE wallet balance.
 * Uses per-row CAS so concurrent cron runs do not double-release.
 */
export async function releaseDueHeldEarnings(
  db: {
    providerFinanceLedger: TransactionClient["providerFinanceLedger"];
    $transaction: <T>(fn: (tx: TransactionClient) => Promise<T>) => Promise<T>;
  },
  options?: { now?: Date; take?: number }
) {
  const now = options?.now ?? new Date();
  const take = options?.take ?? 200;

  const dueLedgers = await db.providerFinanceLedger.findMany({
    where: {
      status: "HOLD",
      availableAt: { lte: now },
    },
    select: {
      id: true,
      providerId: true,
      providerCredits: true,
      providerAmountUsd: true,
    },
    orderBy: { availableAt: "asc" },
    take,
  });

  let released = 0;

  for (const entry of dueLedgers) {
    const didRelease = await db.$transaction(async (tx) => {
      const claimed = await tx.providerFinanceLedger.updateMany({
        where: {
          id: entry.id,
          status: "HOLD",
        },
        data: {
          status: "AVAILABLE",
        },
      });

      if (claimed.count === 0) {
        return false;
      }

      await getOrCreateProviderWallet(tx, entry.providerId);
      await tx.$queryRaw`
        SELECT id FROM "ProviderWallet" WHERE "providerId" = ${entry.providerId} FOR UPDATE
      `;

      const wallet = await tx.providerWallet.findUnique({
        where: { providerId: entry.providerId },
      });

      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider wallet not found",
        });
      }

      await tx.providerWallet.update({
        where: { providerId: entry.providerId },
        data: {
          heldCredits: Math.max(0, wallet.heldCredits - entry.providerCredits),
          heldUsd: roundUsd(Math.max(0, wallet.heldUsd - entry.providerAmountUsd)),
          balanceCredits: wallet.balanceCredits + entry.providerCredits,
          balanceUsd: roundUsd(wallet.balanceUsd + entry.providerAmountUsd),
        },
      });

      return true;
    });

    if (didRelease) {
      released += 1;
    }
  }

  return { released, scanned: dueLedgers.length };
}

export function normalizePayoutDetails(input: PayoutDetailsInput): NormalizedPayoutDetails {
  const accountHolder = input.accountHolder.trim();
  if (!accountHolder) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Account holder name is required",
    });
  }

  if (input.payoutMethod === "BANK") {
    const bankName = input.bankName?.trim() ?? "";
    const bankAccount = input.bankAccount?.trim() ?? "";
    if (!bankName || !bankAccount) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Bank name and account number are required for bank payouts",
      });
    }

    return {
      payoutMethod: "BANK",
      accountHolder,
      bankName,
      bankAccount,
      eWalletNumber: null,
    };
  }

  const eWalletNumber = input.eWalletNumber?.trim() ?? "";
  if (!eWalletNumber) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "E-wallet number is required for e-wallet payouts",
    });
  }

  return {
    payoutMethod: "E_WALLET",
    accountHolder,
    bankName: null,
    bankAccount: null,
    eWalletNumber,
  };
}

export function payoutDetailsFromProfile(profile: {
  payoutMethod: PayoutMethodValue | null;
  accountHolder: string | null;
  bankName: string | null;
  bankAccount: string | null;
  eWalletNumber: string | null;
}): NormalizedPayoutDetails {
  if (!profile.payoutMethod || !profile.accountHolder) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add a bank account or e-wallet number before requesting a withdrawal",
    });
  }

  return normalizePayoutDetails({
    payoutMethod: profile.payoutMethod,
    accountHolder: profile.accountHolder,
    bankName: profile.bankName,
    bankAccount: profile.bankAccount,
    eWalletNumber: profile.eWalletNumber,
  });
}

export function allocateWithdrawalAmounts(
  amountUsd: number,
  balanceUsd: number,
  balanceCredits: number
) {
  const requested = roundUsd(amountUsd);
  const available = roundUsd(balanceUsd);

  if (!Number.isFinite(requested) || requested < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Minimum withdrawal amount is 1 USD",
    });
  }

  if (available < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Insufficient wallet balance",
    });
  }

  if (requested > available) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Withdrawal amount exceeds available balance",
    });
  }

  if (requested === available) {
    return {
      amountUsd: available,
      amountCredits: Math.max(0, balanceCredits),
    };
  }

  const amountCredits =
    available > 0 && balanceCredits > 0
      ? Math.min(balanceCredits, Math.round((requested / available) * balanceCredits))
      : 0;

  return {
    amountUsd: requested,
    amountCredits,
  };
}

async function loadWalletForUpdate(tx: TransactionClient, providerId: string) {
  await getOrCreateProviderWallet(tx, providerId);

  // Take a real row lock (SELECT ... FOR UPDATE) so concurrent withdrawals,
  // reviews, and payouts for the same provider serialize on the wallet row
  // for the duration of the transaction. This prevents double-holds and
  // over-payouts from stale balance reads.
  await tx.$queryRaw`
    SELECT id FROM "ProviderWallet" WHERE "providerId" = ${providerId} FOR UPDATE
  `;

  const wallet = await tx.providerWallet.findUnique({
    where: { providerId },
  });

  if (!wallet) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Provider wallet not found",
    });
  }

  return wallet;
}

export async function requestProviderWithdrawal(
  tx: TransactionClient,
  params: {
    providerId: string;
    amountUsd: number;
    providerNote?: string | null;
  }
) {
  const profile = await tx.providerProfile.findUnique({
    where: { userId: params.providerId },
    select: {
      payoutMethod: true,
      accountHolder: true,
      bankName: true,
      bankAccount: true,
      eWalletNumber: true,
    },
  });

  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Provider profile not found",
    });
  }

  const payout = payoutDetailsFromProfile(profile);

  // Lock the wallet row FIRST: concurrent withdrawal requests for this
  // provider serialize here, so the pending-count check below cannot race.
  const wallet = await loadWalletForUpdate(tx, params.providerId);

  const pendingCount = await tx.withdrawalRequest.count({
    where: {
      providerId: params.providerId,
      status: "PENDING",
    },
  });

  if (pendingCount > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "You already have a pending withdrawal request",
    });
  }

  const allocation = allocateWithdrawalAmounts(
    params.amountUsd,
    wallet.balanceUsd,
    wallet.balanceCredits
  );

  const withdrawal = await tx.withdrawalRequest.create({
    data: {
      providerId: params.providerId,
      amountUsd: allocation.amountUsd,
      amountCredits: allocation.amountCredits,
      payoutMethod: payout.payoutMethod,
      accountHolder: payout.accountHolder,
      bankName: payout.bankName,
      bankAccount: payout.bankAccount,
      eWalletNumber: payout.eWalletNumber,
      providerNote: params.providerNote?.trim() || null,
      status: "PENDING",
      source: "PROVIDER",
    },
  });

  await tx.providerWallet.update({
    where: { providerId: params.providerId },
    data: {
      balanceCredits: wallet.balanceCredits - allocation.amountCredits,
      pendingCredits: wallet.pendingCredits + allocation.amountCredits,
      balanceUsd: roundUsd(wallet.balanceUsd - allocation.amountUsd),
      pendingUsd: roundUsd(wallet.pendingUsd + allocation.amountUsd),
    },
  });

  return withdrawal;
}

export async function reviewProviderWithdrawal(
  tx: TransactionClient,
  params: {
    withdrawalId: string;
    adminId: string;
    status: "APPROVED" | "REJECTED";
    reason: string;
  }
) {
  const reason = params.reason.trim();
  if (reason.length < 5) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please provide a reason of at least 5 characters",
    });
  }

  const withdrawal = await tx.withdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });

  if (!withdrawal) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Withdrawal request not found",
    });
  }

  // Lock the provider's wallet row first, then re-read the withdrawal:
  // concurrent admin reviews serialize on the wallet lock, and the second
  // reviewer must see the already-updated status before proceeding.
  const wallet = await loadWalletForUpdate(tx, withdrawal.providerId);

  const freshWithdrawal = await tx.withdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });

  if (!freshWithdrawal || freshWithdrawal.status !== "PENDING") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This withdrawal has already been reviewed",
    });
  }

  if (params.status === "APPROVED") {
    await tx.providerWallet.update({
      where: { providerId: withdrawal.providerId },
      data: {
        pendingCredits: Math.max(0, wallet.pendingCredits - withdrawal.amountCredits),
        paidCredits: wallet.paidCredits + withdrawal.amountCredits,
        pendingUsd: roundUsd(Math.max(0, wallet.pendingUsd - withdrawal.amountUsd)),
        paidUsd: roundUsd(wallet.paidUsd + withdrawal.amountUsd),
      },
    });
  } else {
    await tx.providerWallet.update({
      where: { providerId: withdrawal.providerId },
      data: {
        pendingCredits: Math.max(0, wallet.pendingCredits - withdrawal.amountCredits),
        balanceCredits: wallet.balanceCredits + withdrawal.amountCredits,
        pendingUsd: roundUsd(Math.max(0, wallet.pendingUsd - withdrawal.amountUsd)),
        balanceUsd: roundUsd(wallet.balanceUsd + withdrawal.amountUsd),
      },
    });
  }

  return tx.withdrawalRequest.update({
    where: { id: withdrawal.id },
    data: {
      status: params.status,
      adminReason: reason,
      reviewedById: params.adminId,
      reviewedAt: new Date(),
    },
  });
}

export async function sendProviderPayout(
  tx: TransactionClient,
  params: {
    providerId: string;
    adminId: string;
    amountUsd: number;
    reason: string;
  }
) {
  const reason = params.reason.trim();
  if (reason.length < 5) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please provide a reason of at least 5 characters",
    });
  }

  const profile = await tx.providerProfile.findUnique({
    where: { userId: params.providerId },
    select: {
      payoutMethod: true,
      accountHolder: true,
      bankName: true,
      bankAccount: true,
      eWalletNumber: true,
    },
  });

  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Provider profile not found",
    });
  }

  const payout = payoutDetailsFromProfile(profile);
  const wallet = await loadWalletForUpdate(tx, params.providerId);
  const allocation = allocateWithdrawalAmounts(
    params.amountUsd,
    wallet.balanceUsd,
    wallet.balanceCredits
  );
  const now = new Date();

  const withdrawal = await tx.withdrawalRequest.create({
    data: {
      providerId: params.providerId,
      amountUsd: allocation.amountUsd,
      amountCredits: allocation.amountCredits,
      payoutMethod: payout.payoutMethod,
      accountHolder: payout.accountHolder,
      bankName: payout.bankName,
      bankAccount: payout.bankAccount,
      eWalletNumber: payout.eWalletNumber,
      status: "APPROVED",
      source: "ADMIN",
      adminReason: reason,
      reviewedById: params.adminId,
      reviewedAt: now,
    },
  });

  await tx.providerWallet.update({
    where: { providerId: params.providerId },
    data: {
      balanceCredits: wallet.balanceCredits - allocation.amountCredits,
      paidCredits: wallet.paidCredits + allocation.amountCredits,
      balanceUsd: roundUsd(wallet.balanceUsd - allocation.amountUsd),
      paidUsd: roundUsd(wallet.paidUsd + allocation.amountUsd),
    },
  });

  return withdrawal;
}
