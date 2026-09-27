"use client";

import { usePathname as useNextPathname } from "next/navigation";
import { usePathname, routing, type AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { buildLocaleSwitchApiHref, LOCALE_SWITCH_CACHE_BUST } from "@/lib/locale-switch";

export { LOCALE_SWITCH_CACHE_BUST };

const locales = [
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "ar", label: "AR", flag: "🇸🇦" },
] as const;

const LOCALE_CODES = routing.locales;

/**
 * Builds the localized URL for a locale switch, respecting `localePrefix: "as-needed"`
 * (default `en` has no prefix). Strips any existing locale segment to avoid
 * double-prefixing (e.g. "/ar/provider" + "en" → "/provider").
 */
export function buildLocaleSwitchPath(pathname: string, targetLocale: AppLocale): string {
  const segments = pathname.split("/").filter(Boolean);
  const isFirstSegmentLocale = (LOCALE_CODES as readonly string[]).includes(segments[0] ?? "");

  let pathWithoutLocale = pathname;
  if (isFirstSegmentLocale) {
    const remaining = segments.slice(1).join("/");
    pathWithoutLocale = remaining ? `/${remaining}` : "/";
  }

  if (targetLocale === routing.defaultLocale) {
    return pathWithoutLocale === "/" ? "/" : pathWithoutLocale;
  }

  return pathWithoutLocale === "/" ? `/${targetLocale}` : `/${targetLocale}${pathWithoutLocale}`;
}

/** Unprefixed default-locale URLs may still be cached as 308 → `/ar…` in older clients. */
export function withLocaleSwitchCacheBust(path: string, targetLocale: AppLocale): string {
  if (targetLocale !== routing.defaultLocale) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${LOCALE_SWITCH_CACHE_BUST}=${targetLocale}`;
}

/** Prefer the browser path over useLocale() so cookie/context drift cannot no-op the toggle. */
export function localeFromBrowserPath(fullPathname: string): AppLocale {
  const first = fullPathname.split("/").filter(Boolean)[0];
  return first === "ar" ? "ar" : "en";
}

export function LanguageSwitcher() {
  const fullPathname = useNextPathname() || "/";
  const pathname = usePathname() || "/";

  const locale = localeFromBrowserPath(fullPathname);
  const targetLocale: AppLocale = locale === "en" ? "ar" : "en";
  const targetLanguage = locales.find((l) => l.code === targetLocale) ?? locales[0];

  // API route sets the cookie then redirects — works without client JS onClick.
  const href = buildLocaleSwitchApiHref(targetLocale, pathname);

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-8 w-8 shrink-0 gap-0 px-0 text-foreground hover:text-foreground sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
    >
      <a
        href={href}
        hrefLang={targetLocale}
        aria-label={`Switch language to ${targetLanguage.label}`}
      >
        <span className="text-sm">{targetLanguage.flag}</span>
        <span className="hidden sm:inline text-sm">{targetLanguage.label}</span>
      </a>
    </Button>
  );
}
