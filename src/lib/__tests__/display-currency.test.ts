import {
  DEFAULT_DISPLAY_CURRENCY,
  formatDisplayCurrency,
  usdToDisplayAmount,
  USD_TO_EGP_RATE,
} from "@/lib/display-currency";

describe("display currency layer", () => {
  it("defaults display currency to EGP", () => {
    expect(DEFAULT_DISPLAY_CURRENCY).toBe("EGP");
    expect(formatDisplayCurrency(1)).toBe("50 EGP");
  });

  it("keeps USD amounts unchanged", () => {
    expect(usdToDisplayAmount(3.6, "USD")).toBe(3.6);
    expect(formatDisplayCurrency(0.00977, "USD")).toBe("$0.0098");
  });

  it("converts to EGP at the fixed rate for display only", () => {
    expect(USD_TO_EGP_RATE).toBe(50);
    expect(usdToDisplayAmount(1, "EGP")).toBe(50);
    expect(usdToDisplayAmount(0.0085, "EGP")).toBe(0.425);
    expect(formatDisplayCurrency(1, "EGP", "en")).toBe("50 EGP");
    expect(formatDisplayCurrency(1, "EGP", "ar")).toBe("50 ج.م");
  });
});
