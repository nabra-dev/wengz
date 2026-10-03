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

/** Interpolate next-intl `{var}` and i18n-js `%{var}` after lookup. */
function applyVars(
  template: string,
  options?: Record<string, string | number> & { defaultValue?: string }
): string {
  if (!options) return template;
  let out = template;
  for (const [key, value] of Object.entries(options)) {
    if (key === "defaultValue" || value === undefined) continue;
    const str = String(value);
    out = out.split(`{${key}}`).join(str);
    out = out.split(`%{${key}}`).join(str);
    // ICU-ish plural stubs used in a few web keys — keep simple fallback
    out = out.replace(new RegExp(`\\{${key},[^}]+\\}`, "g"), str);
  }
  return out;
}

export function t(
  key: string,
  options?: Record<string, string | number> & { defaultValue?: string }
): string {
  const raw = i18n.t(key, options);
  let result = typeof raw === "string" ? raw : String(raw);

  if (result.startsWith("[missing") || result === key) {
    if (options?.defaultValue) return applyVars(options.defaultValue, options);
    return key.split(".").pop() || key;
  }

  result = applyVars(result, options);
  return result;
}
