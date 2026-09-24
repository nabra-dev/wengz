"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { formatDisplayCurrency } from "@/lib/display-currency";

/**
 * Display-only money formatter. Always pass USD amounts from the API;
 * conversion to EGP (if selected) happens only for presentation.
 */
export function useFormatCurrency() {
  const locale = useLocale();
  const { currency } = useDisplayCurrency();

  return useCallback(
    (amountUsd: number) => formatDisplayCurrency(amountUsd, currency, locale),
    [currency, locale]
  );
}
