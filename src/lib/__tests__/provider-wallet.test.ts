import {
  allocateWithdrawalAmounts,
  calculateProviderFinance,
  normalizePayoutDetails,
} from "@/lib/provider-wallet";

describe("provider wallet finance calculation", () => {
  it("applies commission to both credits and USD (Option A)", () => {
    expect(calculateProviderFinance(500, 1, 10)).toMatchObject({
      totalCredits: 500,
      providerCredits: 450,
      platformCredits: 50,
      creditPriceUsd: 1,
      commissionPercent: 10,
      totalAmountUsd: 500,
      platformAmountUsd: 50,
      providerAmountUsd: 450,
    });
  });

  it("credits 100% when commission is 0", () => {
    expect(calculateProviderFinance(200, 1, 0)).toMatchObject({
      providerCredits: 200,
      platformCredits: 0,
      providerAmountUsd: 200,
      platformAmountUsd: 0,
      totalAmountUsd: 200,
    });
  });

  it("gives provider nothing when commission is 100%", () => {
    expect(calculateProviderFinance(100, 2, 100)).toMatchObject({
      providerCredits: 0,
      platformCredits: 100,
      totalAmountUsd: 200,
      platformAmountUsd: 200,
      providerAmountUsd: 0,
    });
  });

  it("converts using global credit price", () => {
    expect(calculateProviderFinance(100, 2, 10)).toMatchObject({
      providerCredits: 90,
      platformCredits: 10,
      totalAmountUsd: 200,
      platformAmountUsd: 20,
      providerAmountUsd: 180,
    });
  });

  it("derives USD from credit split so credits and dollars stay aligned", () => {
    const result = calculateProviderFinance(5, 1, 10);
    expect(result).toMatchObject({
      platformCredits: 1,
      providerCredits: 4,
      platformAmountUsd: 1,
      providerAmountUsd: 4,
      totalAmountUsd: 5,
    });
    expect(result.platformAmountUsd + result.providerAmountUsd).toBe(result.totalAmountUsd);
  });

  it("rounds USD from credits when credit price is fractional", () => {
    const result = calculateProviderFinance(3, 1.333, 10);
    // 10% of 3 credits rounds to 0 platform credits → all USD goes to provider
    expect(result.platformCredits).toBe(0);
    expect(result.providerCredits).toBe(3);
    expect(result.totalAmountUsd).toBe(4);
    expect(result.platformAmountUsd).toBe(0);
    expect(result.providerAmountUsd).toBe(4);
    expect(result.platformAmountUsd + result.providerAmountUsd).toBe(result.totalAmountUsd);
  });
});

describe("payout details", () => {
  it("requires bank name and account number for bank payouts", () => {
    expect(
      normalizePayoutDetails({
        payoutMethod: "BANK",
        accountHolder: " Omar Ali ",
        bankName: " CIB ",
        bankAccount: " EG123 ",
      })
    ).toEqual({
      payoutMethod: "BANK",
      accountHolder: "Omar Ali",
      bankName: "CIB",
      bankAccount: "EG123",
      eWalletNumber: null,
    });

    expect(() =>
      normalizePayoutDetails({
        payoutMethod: "BANK",
        accountHolder: "Omar Ali",
        bankName: "CIB",
        bankAccount: "",
      })
    ).toThrow("Bank name and account number are required for bank payouts");
  });

  it("requires an e-wallet number for e-wallet payouts", () => {
    expect(
      normalizePayoutDetails({
        payoutMethod: "E_WALLET",
        accountHolder: "Omar Ali",
        eWalletNumber: " 01000000000 ",
      })
    ).toEqual({
      payoutMethod: "E_WALLET",
      accountHolder: "Omar Ali",
      bankName: null,
      bankAccount: null,
      eWalletNumber: "01000000000",
    });
  });
});

describe("allocateWithdrawalAmounts", () => {
  it("allocates full credits when withdrawing full USD balance", () => {
    expect(allocateWithdrawalAmounts(450, 450, 450)).toEqual({
      amountUsd: 450,
      amountCredits: 450,
    });
  });

  it("rejects amounts below 1 USD", () => {
    expect(() => allocateWithdrawalAmounts(0.5, 100, 100)).toThrow(
      "Minimum withdrawal amount is 1 USD"
    );
  });
});
