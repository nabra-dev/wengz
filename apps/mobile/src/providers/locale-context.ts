import { createContext } from "react";
import type { AppLocale } from "../i18n";

export type LocaleDirection = "ltr" | "rtl";

export type LocaleContextValue = {
  locale: AppLocale;
  direction: LocaleDirection;
  setLocale: (locale: AppLocale) => Promise<void>;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);
