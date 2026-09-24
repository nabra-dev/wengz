"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";

type CurrencySwitcherProps = {
  /** Compact control for mobile header; full width label in sidebar. */
  variant?: "icon" | "full";
  className?: string;
};

export function CurrencySwitcher({
  variant = "icon",
  className,
}: CurrencySwitcherProps) {
  const t = useTranslations("common.currency");
  const { currency, toggleCurrency } = useDisplayCurrency();
  const next = currency === "USD" ? "EGP" : "USD";

  if (variant === "full") {
    return (
      <Button
        variant="outline"
        size="sm"
        className={className ?? "w-full justify-start text-xs sm:text-sm gap-2"}
        onClick={toggleCurrency}
        aria-label={t("switchTo", { currency: next })}
      >
        <span className="font-semibold tabular-nums">{currency}</span>
        <span className="text-muted-foreground">{t("displayOnly")}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleCurrency}
      className={className ?? "gap-1.5 px-2"}
      aria-label={t("switchTo", { currency: next })}
    >
      <span className="text-sm font-semibold tabular-nums">{currency}</span>
    </Button>
  );
}
