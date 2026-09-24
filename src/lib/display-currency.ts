import { formatMoneyAmount, roundMoney } from "@/lib/utils";

/** Display-only currencies. All business logic / storage stays in USD. */
export const DISPLAY_CURRENCIES = ["USD", "EGP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Fixed display conversion — not a live FX rate. */
export const USD_TO_EGP_RATE = 50;

export const DISPLAY_CURRENCY_STORAGE_KEY = "wengz-display-currency";

/** Default UI currency for header/sidebar switcher when nothing is stored. */
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = "EGP";

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return value === "USD" || value === "EGP";
}

/**
 * Convert a USD amount into the selected display currency.
 * Does not change stored/business values — presentation only.
 */
export function usdToDisplayAmount(
  amountUsd: number,
  currency: DisplayCurrency
): number {
  const usd = Number.isFinite(amountUsd) ? amountUsd : 0;
  if (currency === "EGP") {
    return roundMoney(usd * USD_TO_EGP_RATE);
  }
  return roundMoney(usd);
}

/**
 * Format a USD amount for UI display in USD or EGP.
 * Always pass the canonical USD value from the backend.
 */
export function formatDisplayCurrency(
  amountUsd: number,
  currency: DisplayCurrency = DEFAULT_DISPLAY_CURRENCY,
  locale: string = "en"
): string {
  const amount = usdToDisplayAmount(amountUsd, currency);
  const formatted = formatMoneyAmount(amount, locale);

  if (currency === "EGP") {
    return locale === "ar" ? `${formatted} ج.م` : `${formatted} EGP`;
  }

  return `$${formatted}`;
}
