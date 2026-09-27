/** Query flag that bypasses historically cached permanent redirects on unprefixed URLs. */
export const LOCALE_SWITCH_CACHE_BUST = "lng";

/** Sets NEXT_LOCALE then redirects — used by the language switcher. */
export function buildLocaleSwitchApiHref(targetLocale: string, pathWithoutLocale: string): string {
  const next = pathWithoutLocale.startsWith("/") ? pathWithoutLocale : `/${pathWithoutLocale}`;
  return `/api/locale?set=${encodeURIComponent(targetLocale)}&next=${encodeURIComponent(next)}`;
}
