import { I18n } from "i18n-js";
import { I18nManager } from "react-native";
import { en } from "./messages/en";
import { ar } from "./messages/ar";
import { getStoredLocale, setStoredLocale } from "../lib/auth-store";

export const i18n = new I18n({ en, ar });
i18n.defaultLocale = "en";
i18n.locale = "en";
i18n.enableFallback = true;

export type AppLocale = "en" | "ar";

export async function initLocale(): Promise<AppLocale> {
  const locale = await getStoredLocale();
  await applyLocale(locale);
  return locale;
}

export async function applyLocale(locale: AppLocale): Promise<void> {
  i18n.locale = locale;
  await setStoredLocale(locale);
  const rtl = locale === "ar";
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

export function t(key: string, options?: Record<string, string | number>): string {
  return i18n.t(key, options);
}
