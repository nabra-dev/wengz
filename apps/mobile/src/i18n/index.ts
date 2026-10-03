import { I18n } from "i18n-js";
import { reloadAppAsync } from "expo";
import { en } from "./messages/en";
import { ar } from "./messages/ar";
import { getStoredLocale, setStoredLocale } from "../lib/auth-store";
import { syncRtlForLocale } from "../rtl";

export const i18n = new I18n({ en, ar });
i18n.defaultLocale = "en";
i18n.locale = "en";
i18n.enableFallback = true;

export type AppLocale = "en" | "ar";

/**
 * Cold start: apply the stored locale, then let `syncRtlForLocale` decide
 * whether the platform needs one reload to pick up native RTL. The attempt is
 * recorded per locale, so a runtime that ignores `forceRTL` falls back to
 * manual mirroring instead of reloading forever.
 */
export async function initLocale(): Promise<{ locale: AppLocale; reloading: boolean }> {
  const locale = await getStoredLocale();
  i18n.locale = locale;
  const { needsReload } = await syncRtlForLocale(locale);

  if (needsReload) {
    void reloadAppAsync();
    return { locale, reloading: true };
  }
  return { locale, reloading: false };
}

/** Persist locale, align native RTL, and reload so the whole tree re-mirrors. */
export async function applyLocale(locale: AppLocale): Promise<void> {
  i18n.locale = locale;
  await setStoredLocale(locale);
  await syncRtlForLocale(locale);
  await reloadAppAsync();
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
