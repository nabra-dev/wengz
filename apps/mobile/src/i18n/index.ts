import { I18n } from "i18n-js";
import { I18nManager, Platform } from "react-native";
import { reloadAppAsync } from "expo";
import { en } from "./messages/en";
import { ar } from "./messages/ar";
import { getStoredLocale, setStoredLocale } from "../lib/auth-store";

export const i18n = new I18n({ en, ar });
i18n.defaultLocale = "en";
i18n.locale = "en";
i18n.enableFallback = true;

export type AppLocale = "en" | "ar";

function syncRtl(rtl: boolean) {
  if (Platform.OS === "web") return false;
  I18nManager.allowRTL(true);
  I18nManager.swapLeftAndRightInRTL(true);
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.forceRTL(rtl);
  return true;
}

export async function initLocale(): Promise<AppLocale> {
  const locale = await getStoredLocale();
  i18n.locale = locale;
  await setStoredLocale(locale);
  const rtlChanged = syncRtl(locale === "ar");
  // Cold start with stored AR while native is still LTR — reload once so RTL sticks.
  if (rtlChanged) {
    await reloadAppAsync();
  }
  return locale;
}

/**
 * Persist locale and sync native RTL. Reloads the app on native so Expo Router
 * direction, tab titles, and layout mirrors apply (forceRTL needs a restart).
 */
export async function applyLocale(
  locale: AppLocale,
  options?: { reload?: boolean }
): Promise<void> {
  const shouldReload = options?.reload ?? true;
  i18n.locale = locale;
  await setStoredLocale(locale);
  syncRtl(locale === "ar");
  if (shouldReload && Platform.OS !== "web") {
    await reloadAppAsync();
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

  return applyVars(result, options);
}
