import { openProviderFinanceDispute } from "@/lib/finance-disputes";

describe("openProviderFinanceDispute validation", () => {
  const tx = {
    providerFinanceLedger: {
      findFirst: jest.fn(),
    },
    withdrawalRequest: {
      findFirst: jest.fn(),
    },
    providerFinanceDispute: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects empty reasons", async () => {
    await expect(
      openProviderFinanceDispute(tx, {
        providerId: "p1",
        reason: "   ",
        ledgerId: "l1",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires exactly one target", async () => {
    await expect(
      openProviderFinanceDispute(tx, {
        providerId: "p1",
        reason: "Something is wrong with this payout entry",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
