"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import type { MouseEventHandler, ReactNode } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { BrandLogo } from "@/components/brand/brand-logo";

export const LANDING_NAV_LINKS = [
  { href: "#services", labelKey: "landing.nav.services" },
  { href: "#gallery", labelKey: "landing.nav.gallery" },
  { href: "#gallery-videos", labelKey: "landing.nav.videos" },
  { href: "#pricing", labelKey: "landing.nav.pricing" },
  { href: "/contact", labelKey: "landing.nav.contact" },
] as const;

type LandingNavHref = (typeof LANDING_NAV_LINKS)[number]["href"];

export function LandingNavLink({
  href,
  className,
  children,
  onClick,
}: {
  href: LandingNavHref | string;
  className?: string;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const pathname = usePathname() || "/";
  const onHome = pathname === "/";
  const resolved = href.startsWith("#") && !onHome ? `/${href}` : href;

  if (resolved.startsWith("#")) {
    return (
      <a href={resolved} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={resolved} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export function LandingHeader() {
  const t = useTranslations();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto mb-1.5 max-w-2xl px-4 text-center text-[11px] leading-snug text-muted-foreground sm:mb-2 sm:truncate sm:px-6 sm:text-xs sm:leading-normal">
        {t("landing.notices.beta")}
      </div>
      <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-6 lg:px-10">
        <div className="relative flex w-full min-w-0 items-center gap-1.5 rounded-full border border-border bg-background/95 px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:gap-3 sm:px-5 sm:py-2.5 lg:bg-background/75 lg:px-6 lg:backdrop-blur-xl">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <BrandLogo tone="auto" className="h-6 sm:h-7 md:h-8" priority />
          </Link>

          <nav
            aria-label={t("landing.nav.ariaLabel")}
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
          >
            {LANDING_NAV_LINKS.map((item) => (
              <LandingNavLink
                key={item.href}
                href={item.href}
                className="rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:px-3.5"
              >
                {t(item.labelKey)}
              </LandingNavLink>
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
            <ThemeSwitcher className="hidden min-[400px]:inline-flex" />
            <LanguageSwitcher variant="icon" />
            <details className="group relative">
              <summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-2.5 text-xs font-semibold text-black shadow-[0_8px_28px_rgba(105,13,212,0.35)] sm:h-9 sm:px-3.5 sm:text-sm [&::-webkit-details-marker]:hidden">
                <span className="lg:hidden">{t("landing.cta.primaryShort")}</span>
                <span className="hidden lg:inline">{t("landing.cta.primary")}</span>
                <ChevronDown
                  className="h-3.5 w-3.5 opacity-80 transition-transform group-open:rotate-180 sm:h-4 sm:w-4"
                  aria-hidden
                />
              </summary>
              <div className="absolute end-0 top-full z-50 mt-2 min-w-[11rem] rounded-xl border border-border bg-background p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
                <Link
                  href="/auth/register"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("landing.cta.asClient")}
                </Link>
                <Link
                  href="/forms/provider"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("landing.cta.asProvider")}
                </Link>
                <div className="-mx-1.5 my-1 h-px bg-border" />
                <Link
                  href="/auth/login"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("common.buttons.signIn")}
                </Link>
              </div>
            </details>
            <details className="group lg:hidden">
              <summary
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-foreground hover:bg-muted sm:h-9 sm:w-9 [&::-webkit-details-marker]:hidden"
                aria-label={t("landing.nav.openMenu")}
              >
                <Menu className="h-5 w-5 group-open:hidden" aria-hidden />
                <X className="hidden h-5 w-5 group-open:block" aria-hidden />
              </summary>
              <nav
                id="landing-mobile-nav"
                aria-label={t("landing.nav.ariaLabel")}
                className="absolute inset-x-0 top-full z-50 mt-3 rounded-2xl border border-border bg-background p-2 shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
              >
                <ul className="flex flex-col gap-0.5">
                  {LANDING_NAV_LINKS.map((item) => (
                    <li key={item.href}>
                      <LandingNavLink
                        href={item.href}
                        className="flex items-center rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                        onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                      >
                        {t(item.labelKey)}
                      </LandingNavLink>
                    </li>
                  ))}
                  <li className="mt-1 border-t border-border pt-1">
                    <Link
                      href="/auth/login"
                      className="flex items-center rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {t("common.buttons.signIn")}
                    </Link>
                  </li>
                  <li className="min-[400px]:hidden">
                    <div className="flex items-center justify-between rounded-xl px-3.5 py-2">
                      <span className="text-sm font-medium text-foreground">
                        {t("landing.nav.theme")}
                      </span>
                      <ThemeSwitcher />
                    </div>
                  </li>
                </ul>
              </nav>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
