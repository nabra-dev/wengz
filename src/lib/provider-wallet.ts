import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

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

function roundEgp(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function calculateProviderFinance(totalCredits: number, creditPriceEgp: number) {
  const normalizedCreditPriceEgp = Math.max(0, creditPriceEgp);
  const totalAmountEgp = roundEgp(totalCredits * normalizedCreditPriceEgp);

  return {
    providerCredits: totalCredits,
    creditPriceEgp: normalizedCreditPriceEgp,
    totalAmountEgp,
    providerAmountEgp: totalAmountEgp,
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
    include: {
      serviceType: true,
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

  const finance = calculateProviderFinance(
    request.creditCost,
    request.serviceType.creditPriceEgp ?? 1
  );

  await getOrCreateProviderWallet(tx, request.providerId);

  const ledger = await tx.providerFinanceLedger.create({
    data: {
      requestId,
      providerId: request.providerId,
      serviceTypeId: request.serviceTypeId,
      totalCredits: request.creditCost,
      providerCredits: finance.providerCredits,
      creditPriceEgp: finance.creditPriceEgp,
      totalAmountEgp: finance.totalAmountEgp,
      providerAmountEgp: finance.providerAmountEgp,
      status: "AVAILABLE",
      settledAt: new Date(),
    },
  });

  await tx.providerWallet.update({
    where: { providerId: request.providerId },
    data: {
      balanceCredits: {
        increment: finance.providerCredits,
      },
      balanceEgp: {
        increment: finance.providerAmountEgp,
      },
    },
  });

  return ledger;
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
  amountEgp: number,
  balanceEgp: number,
  balanceCredits: number
) {
  const requested = roundEgp(amountEgp);
  const available = roundEgp(balanceEgp);

  if (!Number.isFinite(requested) || requested < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Minimum withdrawal amount is 1 EGP",
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
      amountEgp: available,
      amountCredits: Math.max(0, balanceCredits),
    };
  }

  const amountCredits =
    available > 0 && balanceCredits > 0
      ? Math.min(balanceCredits, Math.round((requested / available) * balanceCredits))
      : 0;

  return {
    amountEgp: requested,
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
    amountEgp: number;
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
    params.amountEgp,
    wallet.balanceEgp,
    wallet.balanceCredits
  );

  const withdrawal = await tx.withdrawalRequest.create({
    data: {
      providerId: params.providerId,
      amountEgp: allocation.amountEgp,
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
      balanceEgp: roundEgp(wallet.balanceEgp - allocation.amountEgp),
      pendingEgp: roundEgp(wallet.pendingEgp + allocation.amountEgp),
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
        pendingEgp: roundEgp(Math.max(0, wallet.pendingEgp - withdrawal.amountEgp)),
        paidEgp: roundEgp(wallet.paidEgp + withdrawal.amountEgp),
      },
    });
  } else {
    await tx.providerWallet.update({
      where: { providerId: withdrawal.providerId },
      data: {
        pendingCredits: Math.max(0, wallet.pendingCredits - withdrawal.amountCredits),
        balanceCredits: wallet.balanceCredits + withdrawal.amountCredits,
        pendingEgp: roundEgp(Math.max(0, wallet.pendingEgp - withdrawal.amountEgp)),
        balanceEgp: roundEgp(wallet.balanceEgp + withdrawal.amountEgp),
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
    amountEgp: number;
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
    params.amountEgp,
    wallet.balanceEgp,
    wallet.balanceCredits
  );
  const now = new Date();

  const withdrawal = await tx.withdrawalRequest.create({
    data: {
      providerId: params.providerId,
      amountEgp: allocation.amountEgp,
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
      balanceEgp: roundEgp(wallet.balanceEgp - allocation.amountEgp),
      paidEgp: roundEgp(wallet.paidEgp + allocation.amountEgp),
    },
  });

  return withdrawal;
}
