"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

export const LANDING_NAV_LINKS = [
  { href: "#services", labelKey: "landing.nav.services" },
  { href: "#gallery", labelKey: "landing.nav.gallery" },
  { href: "#gallery-videos", labelKey: "landing.nav.videos" },
  { href: "#pricing", labelKey: "landing.nav.pricing" },
  { href: "/contact", labelKey: "landing.nav.contact" },
] as const;

const CREATOR_NAV_CLASS =
  "group inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-[#690DD4] transition-colors hover:bg-[#690DD4]/[0.08] hover:text-[#5509ad] dark:text-[#E0F840] dark:hover:bg-[#E0F840]/10 dark:hover:text-[#f0ff6a] xl:px-3.5";

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

function useCloseOnOutsideAndEscape(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        onClose();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, containerRef]);
}

export function LandingHeader() {
  const t = useTranslations();
  const pathname = usePathname() || "/";
  const ctaMenuId = useId();
  const mobileMenuId = useId();
  const ctaRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCtaOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useCloseOnOutsideAndEscape(ctaOpen, () => setCtaOpen(false), ctaRef);
  useCloseOnOutsideAndEscape(mobileOpen, () => setMobileOpen(false), mobileRef);

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
            <Link href="/forms/provider" className={`ms-1 ${CREATOR_NAV_CLASS}`}>
              {t("landing.nav.creators")}
              <ArrowUpRight
                className="h-3.5 w-3.5 opacity-55 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-90"
                aria-hidden
              />
            </Link>
          </nav>

          <div className="ms-auto flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
            <ThemeSwitcher className="hidden min-[400px]:inline-flex" />
            <LanguageSwitcher variant="icon" />

            <div ref={ctaRef} className="relative">
              <button
                type="button"
                aria-expanded={ctaOpen}
                aria-controls={ctaMenuId}
                aria-haspopup="menu"
                onClick={() => {
                  setCtaOpen((open) => !open);
                  setMobileOpen(false);
                }}
                className="flex h-8 max-w-[9.5rem] cursor-pointer items-center gap-1 rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-2.5 text-xs font-semibold text-black shadow-[0_8px_28px_rgba(105,13,212,0.35)] sm:h-9 sm:max-w-none sm:px-3.5 sm:text-sm"
              >
                <span className="truncate lg:hidden">{t("landing.cta.primaryShort")}</span>
                <span className="hidden lg:inline">{t("landing.cta.primary")}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 opacity-80 transition-transform sm:h-4 sm:w-4",
                    ctaOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {ctaOpen ? (
                <div
                  id={ctaMenuId}
                  role="menu"
                  className="absolute end-0 top-full z-50 mt-2 min-w-[11rem] rounded-xl border border-border bg-background p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
                >
                  <Link
                    href="/auth/login"
                    role="menuitem"
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={() => setCtaOpen(false)}
                  >
                    {t("landing.cta.signIn")}
                  </Link>
                  <Link
                    href="/auth/register"
                    role="menuitem"
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={() => setCtaOpen(false)}
                  >
                    {t("landing.cta.signUp")}
                  </Link>
                </div>
              ) : null}
            </div>

            <div ref={mobileRef} className="lg:hidden">
              <button
                type="button"
                aria-expanded={mobileOpen}
                aria-controls={mobileMenuId}
                aria-label={t("landing.nav.openMenu")}
                onClick={() => {
                  setMobileOpen((open) => !open);
                  setCtaOpen(false);
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-muted sm:h-9 sm:w-9"
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" aria-hidden />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden />
                )}
              </button>
              {mobileOpen ? (
                <nav
                  id={mobileMenuId}
                  aria-label={t("landing.nav.ariaLabel")}
                  className="absolute inset-x-0 top-full z-50 mt-3 rounded-2xl border border-border bg-background p-2 shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
                >
                  <ul className="flex flex-col gap-0.5">
                    {LANDING_NAV_LINKS.map((item) => (
                      <li key={item.href}>
                        <LandingNavLink
                          href={item.href}
                          className="flex items-center rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                          onClick={() => setMobileOpen(false)}
                        >
                          {t(item.labelKey)}
                        </LandingNavLink>
                      </li>
                    ))}
                    <li>
                      <Link
                        href="/forms/provider"
                        className={`mx-1.5 my-1 justify-center ${CREATOR_NAV_CLASS}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        {t("landing.nav.creators")}
                        <ArrowUpRight
                          className="h-3.5 w-3.5 opacity-55 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-90"
                          aria-hidden
                        />
                      </Link>
                    </li>
                    <li className="mt-1 border-t border-border pt-1">
                      <Link
                        href="/auth/login"
                        className="flex items-center rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                        onClick={() => setMobileOpen(false)}
                      >
                        {t("landing.cta.signIn")}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/auth/register"
                        className="flex items-center rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                        onClick={() => setMobileOpen(false)}
                      >
                        {t("landing.cta.signUp")}
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
