import { routing, type AppLocale } from "@/i18n/routing";

/** Query flag that bypasses historically cached permanent redirects on unprefixed URLs. */
export const LOCALE_SWITCH_CACHE_BUST = "lng";

/**
 * Destination path after a locale switch (relative, no host).
 * Respects `localePrefix: "as-needed"` (default `en` has no prefix).
 */
export function buildLocaleDestinationPath(
  targetLocale: AppLocale | string,
  pathWithoutLocale: string
): string {
  const nextPath = pathWithoutLocale.startsWith("/") ? pathWithoutLocale : `/${pathWithoutLocale}`;

  // Strip accidental locale prefix from next if present.
  const segments = nextPath.split("/").filter(Boolean);
  const first = segments[0];
  const bare =
    first && (routing.locales as readonly string[]).includes(first)
      ? segments.length > 1
        ? `/${segments.slice(1).join("/")}`
        : "/"
      : nextPath === ""
        ? "/"
        : nextPath;

  if (targetLocale === routing.defaultLocale) {
    const join = bare.includes("?") ? "&" : "?";
    return `${bare}${join}${LOCALE_SWITCH_CACHE_BUST}=${targetLocale}`;
  }

  if (bare === "/") return `/${targetLocale}`;
  if (bare.startsWith(`/${targetLocale}/`) || bare === `/${targetLocale}`) return bare;
  return `/${targetLocale}${bare}`;
}

/** Sets NEXT_LOCALE then redirects — used as no-JS fallback href only. */
export function buildLocaleSwitchApiHref(targetLocale: string, pathWithoutLocale: string): string {
  const next = pathWithoutLocale.startsWith("/") ? pathWithoutLocale : `/${pathWithoutLocale}`;
  return `/api/locale?set=${encodeURIComponent(targetLocale)}&next=${encodeURIComponent(next)}`;
}
