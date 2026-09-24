import { formatCurrency, formatMoneyAmount, roundMoney } from "@/lib/utils";

describe("money formatting", () => {
  it("rounds to at most 4 decimal places", () => {
    expect(roundMoney(0.0085)).toBe(0.0085);
    expect(roundMoney(0.00977)).toBe(0.0098);
    expect(roundMoney(3.6)).toBe(3.6);
  });

  it("formats amounts as-is with max 4 decimals", () => {
    expect(formatMoneyAmount(0.0085)).toBe("0.0085");
    expect(formatMoneyAmount(0.00977)).toBe("0.0098");
    expect(formatMoneyAmount(3.6)).toBe("3.6");
    expect(formatCurrency(0.00977)).toBe("$0.0098");
  });
});
