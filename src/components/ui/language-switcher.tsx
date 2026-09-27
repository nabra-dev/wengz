"use client";

import { useTransition, type MouseEvent } from "react";
import { usePathname as useNextPathname } from "next/navigation";
import { usePathname, useRouter, routing, type AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { buildLocaleSwitchApiHref, LOCALE_SWITCH_CACHE_BUST } from "@/lib/locale-switch";
import { cn } from "@/lib/utils";

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

type LanguageSwitcherProps = {
  /** Icon-only control for dense toolbars (sidebar). */
  variant?: "default" | "icon";
  className?: string;
};

async function setLocaleCookie(targetLocale: AppLocale, pathWithoutLocale: string) {
  const res = await fetch("/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ set: targetLocale, next: pathWithoutLocale }),
  });
  if (!res.ok) {
    throw new Error("Failed to set locale");
  }
  return (await res.json()) as { ok: boolean; destination?: string };
}

export function LanguageSwitcher({ variant = "default", className }: LanguageSwitcherProps) {
  const fullPathname = useNextPathname() || "/";
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const locale = localeFromBrowserPath(fullPathname);
  const targetLocale: AppLocale = locale === "en" ? "ar" : "en";
  const targetLanguage = locales.find((l) => l.code === targetLocale) ?? locales[0];

  // Relative API href for progressive enhancement / no-JS (server uses public origin).
  const href = buildLocaleSwitchApiHref(targetLocale, pathname);
  const iconOnly = variant === "icon";

  const onSwitch = (event: MouseEvent<HTMLAnchorElement>) => {
    // Prefer same-origin client navigation — never follow a server Location that
    // might be built from an internal localhost req.url behind a reverse proxy.
    event.preventDefault();
    if (pending) return;

    startTransition(() => {
      void (async () => {
        try {
          await setLocaleCookie(targetLocale, pathname);
        } catch {
          // Cookie set failed — still navigate; middleware may keep prior cookie.
        }
        router.replace(pathname, { locale: targetLocale });
      })();
    });
  };

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      disabled={pending}
      className={cn(
        iconOnly
          ? "h-8 w-8 shrink-0 gap-0 px-0 text-foreground hover:text-foreground sm:h-9 sm:w-9"
          : "h-8 w-8 shrink-0 gap-0 px-0 text-foreground hover:text-foreground sm:h-9 sm:w-auto sm:gap-2 sm:px-3",
        className
      )}
    >
      <a
        href={href}
        hrefLang={targetLocale}
        aria-label={`Switch language to ${targetLanguage.label}`}
        title={targetLanguage.label}
        onClick={onSwitch}
      >
        <span className="text-sm">{targetLanguage.flag}</span>
        {!iconOnly && <span className="hidden sm:inline text-sm">{targetLanguage.label}</span>}
      </a>
    </Button>
  );
}
