"use client";

import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const locales = [
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "ar", label: "AR", flag: "🇸🇦" },
] as const;

/**
 * Builds the target path for a locale switch, stripping any existing locale
 * prefix to avoid double-prefixing (e.g. "/ar/provider" + "en" → "/en/provider").
 */
export function buildLocaleSwitchPath(pathname: string, targetLocale: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const localeList = ["en", "ar"] as const;
  const isFirstSegmentLocale = localeList.includes(segments[0] as (typeof localeList)[number]);

  let pathWithoutLocale = pathname;
  if (isFirstSegmentLocale) {
    const remaining = segments.slice(1).join("/");
    pathWithoutLocale = remaining ? `/${remaining}` : "/";
  }

  return `/${targetLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  // Toggle to the other language
  const targetLocale = locale === "en" ? "ar" : "en";
  const targetLanguage = locales.find((l) => l.code === targetLocale) || locales[0];

  const handleToggle = () => {
    globalThis.location.href = buildLocaleSwitchPath(pathname, targetLocale);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className="h-8 w-8 shrink-0 gap-0 px-0 text-foreground hover:text-foreground sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
    >
      <span className="text-sm">{targetLanguage.flag}</span>
      <span className="hidden sm:inline text-sm">{targetLanguage.label}</span>
    </Button>
  );
}
