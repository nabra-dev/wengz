"use client";

import dynamic from "next/dynamic";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { Check, Loader2, Plus, ArrowUp, LayoutGrid, ArrowUpRight } from "lucide-react";
import { setPendingRequestDescription } from "@/lib/landing-request-draft";
import { BrandLogo } from "@/components/brand/brand-logo";
import { HeroImage } from "@/components/landing/hero-image";
import {
  LANDING_NAV_LINKS,
  LandingHeader,
  LandingNavLink,
} from "@/components/landing/landing-header";
import { WHATSAPP_HREF } from "@/components/marketing/floating-whatsapp";
import type { PublicPackage } from "@/lib/public-packages";
import { cn } from "@/lib/utils";

const ServicesBento = dynamic(() =>
  import("@/components/landing/services-bento").then((mod) => mod.ServicesBento)
);
const ImageMarquee = dynamic(() =>
  import("@/components/landing/image-marquee").then((mod) => mod.ImageMarquee)
);
const VideoMarquee = dynamic(() =>
  import("@/components/landing/video-marquee").then((mod) => mod.VideoMarquee)
);
const InfoSection = dynamic(() =>
  import("@/components/landing/info-section").then((mod) => mod.InfoSection)
);

function AppStoreBadge({ eyebrow, label }: { eyebrow: string; label: string }) {
  return (
    <span className="inline-flex h-11 w-[168px] items-center gap-2 rounded-xl border border-foreground/15 bg-foreground px-3.5 text-background shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:h-14 sm:w-[200px] sm:gap-2.5 sm:px-4">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
      >
        <path d="M16.365 12.052c0-1.857 1.052-2.76 1.1-2.79-.66-.97-1.69-1.1-2.05-1.12-1.1-.11-2.15.65-2.71.65-.56 0-1.43-.63-2.35-.61-1.21.02-2.33.7-2.95 1.78-1.26 2.19-.32 5.43.91 7.21.6.87 1.31 1.84 2.25 1.81.9-.04 1.24-.58 2.33-.58 1.09 0 1.39.58 2.34.56.97-.02 1.58-.88 2.17-1.76.69-1.01.97-1.99 1-2.04-.02-.01-1.9-.73-1.92-2.89-.02-1.81 1.48-2.67 1.55-2.72-.86-1.26-2.19-1.4-2.66-1.43zm-2.0-6.1c.5-.6.83-1.44.74-2.28-.71.03-1.57.47-2.08 1.07-.46.53-.86 1.38-.75 2.19.8.06 1.61-.41 2.09-.98z" />
      </svg>
      <span className="flex min-w-0 flex-col items-start leading-none">
        <span className="whitespace-nowrap text-[9px] font-medium tracking-wide sm:text-[10px]">
          {eyebrow}
        </span>
        <span className="mt-0.5 truncate text-[13px] font-semibold tracking-tight sm:text-base">
          {label}
        </span>
      </span>
    </span>
  );
}

function GooglePlayBadge({ eyebrow, label }: { eyebrow: string; label: string }) {
  return (
    <span className="inline-flex h-11 w-[168px] items-center gap-2 rounded-xl border border-foreground/15 bg-foreground px-3.5 text-background shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:h-14 sm:w-[200px] sm:gap-2.5 sm:px-4">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="h-6 w-6 shrink-0 sm:h-8 sm:w-8"
      >
        <path
          d="M11.724 11.833 3.779 20.542a2.1 2.1 0 0 1-.281-1.084V4.642c-.022-.492.125-.977.416-1.374L11.724 11.833Z"
          fill="#4285F5"
        />
        <path
          d="m15.343 7.865-3.619 3.968L3.914 3.268a2.05 2.05 0 0 1 2.69-.445c2.778 1.655 5.594 3.242 8.4 4.839l.339.203Z"
          fill="#00AE45"
        />
        <path
          d="M19.35 13.749c-1.016.6-2.042 1.18-3.058 1.771l-.784.455-3.784-4.142 3.619-3.968 4.007 2.342a2.02 2.02 0 0 1 0 3.542Z"
          fill="#FFBB00"
        />
        <path
          d="m15.508 15.974-8.971 5.197a2.05 2.05 0 0 1-2.758-.63c-.067-.08-.128-.164-.184-.252L11.724 11.833l3.784 4.141Z"
          fill="#EB4132"
        />
      </svg>
      <span className="flex min-w-0 flex-col items-start leading-none">
        <span className="whitespace-nowrap text-[9px] font-medium tracking-wide sm:text-[10px]">
          {eyebrow}
        </span>
        <span className="mt-0.5 truncate text-[13px] font-semibold tracking-tight sm:text-base">
          {label}
        </span>
      </span>
    </span>
  );
}

// Typography — dark premium landing
const FONT_SIZES = {
  hero: {
    title:
      "text-balance text-[1.25rem] font-semibold leading-[1.3] tracking-tight min-[380px]:text-2xl sm:text-3xl sm:leading-[1.28] md:text-3xl lg:text-4xl lg:leading-[1.25]",
    subtitle:
      "text-[0.75rem] leading-5 text-muted-foreground min-[380px]:text-[0.8125rem] min-[380px]:leading-6 sm:text-sm sm:leading-7",
  },
  sectionTitle: {
    primary:
      "text-[1.75rem] font-semibold leading-[1.3] tracking-tight sm:text-4xl sm:leading-[1.28] md:text-5xl md:leading-[1.25]",
    secondary: "text-2xl leading-[1.3] sm:text-3xl sm:leading-[1.3] md:text-4xl md:leading-[1.28]",
  },
  cardTitle: {
    main: "text-base leading-7 sm:text-lg sm:leading-7",
    small: "text-sm leading-6 md:text-base md:leading-7",
  },
  body: {
    large: "text-base leading-8 sm:text-lg sm:leading-9",
    normal: "text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8",
    small: "text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7",
  },
} as const;

const PROVIDER_BENEFIT_KEYS = ["portfolio", "review", "deliver"] as const;

const FOOTER_SOCIAL = [
  {
    key: "whatsapp" as const,
    href: "https://wa.me/201018249632",
    labelKey: "landing.footer.whatsapp",
  },
  {
    key: "instagram" as const,
    href: "https://www.instagram.com/wengz.ai",
    labelKey: "landing.footer.instagram",
  },
  {
    key: "facebook" as const,
    href: "https://www.facebook.com/profile.php?id=61576454483831",
    labelKey: "landing.footer.facebook",
  },
  {
    key: "tiktok" as const,
    href: "https://www.tiktok.com/@wengz.ai",
    labelKey: "landing.footer.tiktok",
  },
  {
    key: "linkedin" as const,
    href: "https://www.linkedin.com/showcase/wengz/home/",
    labelKey: "landing.footer.linkedin",
  },
] as const;

/** Stable across a request; `suppressHydrationWarning` covers rare TZ year-boundary skew. */
function FooterCopyright({ label }: { label: string }) {
  return (
    <p suppressHydrationWarning className="text-xs text-muted-foreground sm:text-sm">
      {label}
    </p>
  );
}

function SocialIcon({ name }: { name: (typeof FOOTER_SOCIAL)[number]["key"] }) {
  const common = "h-[18px] w-[18px]";
  if (name === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={common}>
        <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.59 2 2.15 6.44 2.15 11.89c0 1.75.46 3.45 1.32 4.95L2.05 22l5.3-1.39a9.84 9.84 0 0 0 4.69 1.19h.01c5.45 0 9.89-4.44 9.89-9.89 0-2.64-1.03-5.12-2.89-6.99Zm-7.01 15.22h-.01a8.17 8.17 0 0 1-4.16-1.14l-.3-.18-3.14.82.84-3.06-.2-.31a8.16 8.16 0 0 1-1.26-4.37c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.18 8.2Zm4.49-6.13c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.74 2.66 4.22 3.73.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.17.21-.58.21-1.07.14-1.17-.06-.11-.23-.18-.48-.3Z" />
      </svg>
    );
  }
  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className={common}>
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (name === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={common}>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1Z" />
      </svg>
    );
  }
  if (name === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={common}>
        <path d="M16.6 5.8A4.9 4.9 0 0 1 14.2 3h-2.7v13.1c0 1.6-1.3 2.9-2.9 2.9S5.7 17.7 5.7 16.1s1.3-2.9 2.9-2.9c.3 0 .6 0 .9.1V10c-.3 0-.6-.1-.9-.1A5.6 5.6 0 0 0 3 15.5 5.6 5.6 0 0 0 8.6 21a5.6 5.6 0 0 0 5.6-5.6V9.5a7.4 7.4 0 0 0 4.3 1.4V8.1a4.9 4.9 0 0 1-1.9-2.3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={common}>
      <path d="M6.3 9.2H3.6v11.3h2.7V9.2ZM5 4.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20.4 20.5h-2.7v-5.5c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.8 1.3-.1.2-.1.5-.1.8v5.9H11v-7.5c0-1.4 0-2.5-.1-3.4h2.3l.1 1.5h.1c.4-.7 1.3-1.7 3.2-1.7 2.1 0 3.8 1.4 3.8 4.4v6.7Z" />
    </svg>
  );
}

type HeroChatPhase = "idle" | "awaitingReply" | "showingReply" | "error";

export default function LandingPage({
  initialPackages = [],
}: {
  initialPackages?: PublicPackage[];
}) {
  const locale = useLocale();
  const t = useTranslations();
  const formatCurrency = useFormatCurrency();
  const isRTL = locale === "ar";
  const textDirectionClass = isRTL ? "text-right" : "text-left";
  const typingCaretSpacingClass = isRTL ? "mr-0.5" : "ml-0.5";

  const [heroPrompt, setHeroPrompt] = useState("");
  const [heroSubmittedPrompt, setHeroSubmittedPrompt] = useState("");
  const [heroChatPhase, setHeroChatPhase] = useState<HeroChatPhase>("idle");
  const [heroReply, setHeroReply] = useState("");
  const [heroLoadingReply, setHeroLoadingReply] = useState(false);
  const [heroTypingReply, setHeroTypingReply] = useState(false);
  const heroReplyScrollRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const packages = initialPackages;

  const getLocalizedText = (
    text: string | undefined,
    i18nObj: Record<string, string> | undefined
  ) => {
    if (!i18nObj) return text || "";
    return i18nObj[locale] || text || "";
  };

  const getPackageFeatures = (pkg: PublicPackage) => {
    if (pkg.featuresI18n?.[locale]) {
      return pkg.featuresI18n[locale];
    }
    return pkg.features || [];
  };

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (heroChatPhase !== "showingReply") return;
    const replyLength = heroReply.length;
    if (replyLength === 0) return;
    if (!heroReplyScrollRef.current) return;
    heroReplyScrollRef.current.scrollTop = heroReplyScrollRef.current.scrollHeight;
  }, [heroChatPhase, heroReply]);

  const startTypingReply = (fullReply: string) => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    setHeroReply("");
    setHeroTypingReply(true);

    let i = 0;
    typingIntervalRef.current = setInterval(() => {
      i += 1;
      setHeroReply(fullReply.slice(0, i));

      if (i >= fullReply.length) {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setHeroTypingReply(false);
      }
    }, 16);
  };

  const renderReplyWithLinks = (text: string) => {
    const nodes: React.ReactNode[] = [];
    const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let lastIndex = 0;
    for (;;) {
      const match = regex.exec(text);
      if (!match) break;

      const [fullMatch, label, href] = match;
      const start = match.index;

      if (start > lastIndex) {
        nodes.push(text.slice(lastIndex, start));
      }

      nodes.push(
        <a
          key={`hero-link-${start}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-muted-foreground underline-offset-4 transition-colors hover:text-foreground"
        >
          {label}
        </a>
      );

      lastIndex = start + fullMatch.length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  };

  const handleHeroSubmit = async () => {
    if (heroChatPhase !== "idle") return;
    const text = heroPrompt.trim();
    if (!text || heroLoadingReply) return;

    setHeroSubmittedPrompt(text);
    setHeroPrompt(text);
    setPendingRequestDescription(text);
    setHeroChatPhase("awaitingReply");

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    setHeroReply("");
    setHeroTypingReply(false);
    setHeroLoadingReply(true);

    try {
      const response = await fetch("/api/landing/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: text,
          locale,
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !data.reply) {
        throw new Error(data.error || "Chat request failed");
      }

      setHeroChatPhase("showingReply");
      startTypingReply(data.reply);
    } catch (error) {
      setHeroChatPhase("error");
      toast.error(
        locale === "ar"
          ? "تعذر توليد الرد الآن. حاول مرة أخرى."
          : "Could not generate a reply right now. Please try again."
      );
    } finally {
      setHeroLoadingReply(false);
    }
  };

  return (
    <div
      className={`relative flex min-h-screen flex-col bg-background text-foreground ${isRTL ? "rtl" : "ltr"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Brand color ambience */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden sm:block">
        <div className="absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#690DD4]/25 blur-3xl" />
        <div className="absolute top-32 right-[-120px] h-[480px] w-[480px] rounded-full bg-wengz-yellow-soft blur-3xl" />
      </div>

      <LandingHeader />

      <main className="relative z-10">
        {/* Hero — full-bleed visual + left headline + glass prompt */}
        <section className="relative isolate flex min-h-landing-screen flex-col overflow-hidden pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(5.75rem+env(safe-area-inset-top,0px))] sm:pb-14 sm:pt-[calc(7rem+env(safe-area-inset-top,0px))] md:pb-16">
          <div className="pointer-events-none absolute inset-0 z-0 min-h-0 overflow-hidden">
            <HeroImage />
            <div
              className={cn(
                "absolute inset-0 from-black/70 via-black/45 to-black/15 sm:via-black/40 sm:to-black/10",
                isRTL ? "bg-gradient-to-l" : "bg-gradient-to-r"
              )}
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/30 sm:via-transparent sm:to-black/25"
              aria-hidden
            />
            <div
              className="absolute inset-0 opacity-30 mix-blend-screen"
              style={{
                backgroundImage: isRTL
                  ? "radial-gradient(ellipse at 30% 45%, rgba(105,13,212,0.4), transparent 55%)"
                  : "radial-gradient(ellipse at 70% 45%, rgba(105,13,212,0.4), transparent 55%)",
              }}
              aria-hidden
            />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 sm:px-6 lg:px-10">
            <div className="pointer-events-none absolute inset-x-4 top-0 bottom-0 z-[1] flex items-center pb-[11.5rem] pt-4 sm:inset-x-6 sm:pb-48 sm:pt-6 lg:inset-x-10 lg:pb-44 lg:pt-0 xl:inset-x-10 [@media(max-height:640px)]:relative [@media(max-height:640px)]:inset-auto [@media(max-height:640px)]:pointer-events-auto [@media(max-height:640px)]:mt-6 [@media(max-height:640px)]:block [@media(max-height:640px)]:pb-0 [@media(max-height:640px)]:pt-0">
              <div className={`pointer-events-auto max-w-md sm:max-w-lg ${textDirectionClass}`}>
                <h1 className={`${FONT_SIZES.hero.title} text-white`}>
                  {t("landing.hero.titleBefore")}
                  <span className="bg-gradient-to-r from-[#690DD4] to-[#E0F840] bg-clip-text text-transparent">
                    {t("landing.hero.titleHighlight")}
                  </span>
                  {t("landing.hero.titleAfter")}
                </h1>
                <p
                  className={`mt-2 max-w-sm sm:mt-3 ${FONT_SIZES.hero.subtitle} text-white/70 [@media(max-height:700px)]:line-clamp-3`}
                >
                  {t("landing.hero.subtitle")}
                </p>
              </div>
            </div>

            <div className="relative z-10 mx-auto mt-auto w-full min-w-0 max-w-3xl rounded-2xl border border-white/30 bg-black/80 p-2.5 shadow-[0_0_0_1px_rgba(105,13,212,0.35),0_0_48px_rgba(105,13,212,0.28),0_24px_64px_rgba(0,0,0,0.55)] transition-[box-shadow,border-color] duration-300 focus-within:border-[#E0F840]/45 focus-within:shadow-[0_0_0_1px_rgba(224,248,64,0.35),0_0_56px_rgba(105,13,212,0.4),0_24px_64px_rgba(0,0,0,0.55)] sm:rounded-3xl sm:p-4 lg:bg-black/70 lg:backdrop-blur-2xl">
              <div className="relative min-h-[4.5rem]">
                {heroChatPhase === "showingReply" ? (
                  <div
                    ref={heroReplyScrollRef}
                    className={`relative z-[1] max-h-56 overflow-y-auto px-3 py-2 ${textDirectionClass}`}
                  >
                    <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                      {locale === "ar" ? "رد وينجز" : "Wengz reply"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-8 text-white">
                      {renderReplyWithLinks(heroReply)}
                      {heroTypingReply ? (
                        <span
                          className={`${typingCaretSpacingClass} inline-block animate-pulse text-white/50`}
                        >
                          |
                        </span>
                      ) : null}
                    </p>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={heroChatPhase === "idle" ? heroPrompt : heroSubmittedPrompt}
                      onChange={(e) => {
                        if (heroChatPhase !== "idle") return;
                        setHeroPrompt(e.target.value);
                      }}
                      readOnly={heroChatPhase !== "idle"}
                      placeholder={t("landing.hero.promptPlaceholder")}
                      rows={2}
                      className={`relative z-[1] w-full resize-none bg-transparent px-3 py-2 text-sm leading-8 text-white placeholder:text-white/45 focus:outline-none focus:ring-0 read-only:cursor-default ${textDirectionClass}`}
                      onKeyDown={(e) => {
                        if (heroChatPhase !== "idle") return;
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleHeroSubmit();
                        }
                      }}
                      aria-label={t("landing.hero.promptPlaceholder")}
                    />
                    {heroChatPhase === "awaitingReply" && heroLoadingReply ? (
                      <p
                        className={`px-3 pb-1 text-xs text-white/55 ${textDirectionClass}`}
                        aria-live="polite"
                      >
                        {t("landing.hero.working")}
                      </p>
                    ) : null}
                    {heroChatPhase === "error" ? (
                      <p
                        className={`relative z-[1] px-3 pb-2 text-sm text-red-400 ${textDirectionClass}`}
                      >
                        {locale === "ar"
                          ? "تعذر توليد الرد. جرّب مرة تانية."
                          : "Couldn’t get a reply. Try again."}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex flex-nowrap items-center justify-between gap-2 border-t border-white/15 px-1.5 pb-1 pt-2 sm:px-2">
                <div className="group relative shrink-0">
                  {heroChatPhase === "idle" ? (
                    <>
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-full p-1.5 text-white/40 opacity-50 sm:p-2"
                        aria-label={t("landing.hero.uploadTooltip")}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-white/15 bg-black/90 px-2.5 py-1.5 text-center text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                      >
                        {t("landing.hero.uploadTooltip")}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (typingIntervalRef.current) {
                          clearInterval(typingIntervalRef.current);
                          typingIntervalRef.current = null;
                        }
                        setHeroChatPhase("idle");
                        setHeroPrompt("");
                        setHeroSubmittedPrompt("");
                        setHeroReply("");
                        setHeroTypingReply(false);
                        setHeroLoadingReply(false);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {t("landing.hero.askAgain")}
                    </button>
                  )}
                </div>
                <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
                  <span
                    className="inline-flex shrink-0 rounded-full p-1.5 text-white/40 sm:p-2"
                    aria-hidden="true"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleHeroSubmit()}
                    disabled={heroChatPhase !== "idle" || heroLoadingReply || !heroPrompt.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#690DD4] to-[#E0F840] text-black shadow-[0_8px_24px_rgba(105,13,212,0.35)] transition-all hover:scale-[1.03] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55 sm:h-9 sm:w-9"
                    aria-label={t("landing.cta.primary")}
                  >
                    {heroLoadingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ServicesBento />
        <ImageMarquee />
        <VideoMarquee />
        <InfoSection />

        {/* Provider form CTA */}
        <section className="relative w-full overflow-hidden border-t border-border bg-background py-12 sm:py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(ellipse_at_0%_50%,rgba(105,13,212,0.22),transparent_55%)]" />
            <div className="absolute inset-y-0 right-0 w-full bg-[radial-gradient(ellipse_at_100%_40%,rgba(224,248,64,0.08),transparent_50%)]" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "64px 64px",
                maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
              }}
              aria-hidden
            />
          </div>

          <div className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-10">
            <div className={textDirectionClass}>
              <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-wengz-yellow-muted">
                {t("landing.forms.eyebrow")}
              </p>
              <h2
                className={`${FONT_SIZES.sectionTitle.primary} max-w-xl text-balance text-foreground`}
              >
                {t("landing.forms.heading")}
              </h2>
              <p className={`mt-5 max-w-md ${FONT_SIZES.body.normal}`}>
                {t("landing.forms.subheading")}
              </p>
              <div className="mt-9">
                <Button
                  asChild
                  className="group h-11 w-full rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-8 text-sm font-semibold text-black shadow-[0_12px_40px_rgba(105,13,212,0.35)] transition-all hover:opacity-95 sm:h-12 sm:w-auto"
                >
                  <Link href="/forms/provider" className="inline-flex items-center gap-2">
                    {t("landing.forms.provider.cta")}
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:rotate-[-90deg] rtl:group-hover:-translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <ol className={`flex flex-col gap-0 border-t border-border ${textDirectionClass}`}>
              {PROVIDER_BENEFIT_KEYS.map((key, index) => (
                <li
                  key={key}
                  className="group grid grid-cols-[auto_1fr] gap-4 border-b border-border py-5 sm:gap-5 sm:py-6"
                >
                  <span className="pt-0.5 font-mono text-xs tabular-nums text-wengz-yellow-muted sm:text-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-base font-medium leading-7 text-foreground transition-colors group-hover:text-wengz-yellow sm:text-lg sm:leading-7">
                      {t(`landing.forms.benefits.${key}.title`)}
                    </h3>
                    <p className="mt-1.5 text-sm leading-8 text-muted-foreground">
                      {t(`landing.forms.benefits.${key}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="relative w-full scroll-mt-28 overflow-hidden border-t border-border bg-background py-12 sm:scroll-mt-32 sm:py-24 md:py-32"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(105,13,212,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(224,248,64,0.07),transparent_50%)]"
          />
          <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-foreground sm:mb-5`}>
                {t("landing.pricing.heading")}
              </h2>
              <p className={FONT_SIZES.body.normal}>{t("landing.pricing.subheading")}</p>
              <p className="mt-5 text-sm font-medium leading-7 text-wengz-yellow sm:text-base sm:leading-8">
                {t("landing.pricing.freeTrialNote")}
              </p>
            </div>

            <div className="grid w-full grid-cols-1 items-stretch gap-5 overflow-visible sm:gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-7">
              {packages.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  {t("landing.pricing.empty")}
                </p>
              )}
              {packages.length > 0 &&
                packages.map((pkg) => {
                  const featured = Boolean(pkg.isFeatured);
                  const description = getLocalizedText(pkg.description, pkg.descriptionI18n);
                  const features = getPackageFeatures(pkg);

                  return (
                    <div
                      key={pkg.id}
                      className={cn(
                        "relative flex overflow-visible",
                        featured && "xl:-mt-3 xl:mb-[-0.75rem]"
                      )}
                    >
                      <div
                        className={cn(
                          "relative flex h-full w-full min-w-0 flex-col overflow-visible rounded-[1.75rem] border p-5 transition-all duration-300 sm:p-7",
                          featured
                            ? "mt-3 border-transparent bg-gradient-to-b from-[#690DD4]/20 via-card to-card shadow-[0_24px_80px_rgba(105,13,212,0.22)] ring-1 ring-[#690DD4]/35 xl:mt-0"
                            : "border-border/80 bg-card/80 hover:-translate-y-1 hover:border-[#690DD4]/35 hover:shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
                        )}
                      >
                        {featured ? (
                          <>
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E0F840] to-transparent" />
                            <div className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2">
                              <Badge className="border-0 bg-[#690DD4] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-wengz-yellow shadow-[0_8px_24px_rgba(105,13,212,0.4)] ring-2 ring-background">
                                {t("landing.pricing.featuredBadge")}
                              </Badge>
                            </div>
                          </>
                        ) : null}

                        <h3 className="mb-5 break-words text-base font-semibold tracking-tight text-foreground sm:text-lg">
                          {getLocalizedText(pkg.name, pkg.nameI18n)}
                        </h3>

                        <div className="mb-5">
                          <div className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                            {formatCurrency(pkg.price)}
                            <span className="ms-1 text-sm font-medium text-muted-foreground sm:text-base">
                              {t("landing.pricing.perMonth")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[#690DD4] dark:text-wengz-yellow">
                            {t("landing.pricing.credits", {
                              count: pkg.credits.toLocaleString(locale),
                            })}
                          </p>
                        </div>

                        {description ? (
                          <p className="mb-5 text-sm leading-6 text-muted-foreground">
                            {description}
                          </p>
                        ) : (
                          <div className="mb-5" />
                        )}

                        <ul className="mb-7 flex flex-1 flex-col gap-2.5">
                          {features.map((feature, featureIdx) => (
                            <li
                              key={`${pkg.id}-${featureIdx}`}
                              className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90"
                            >
                              <Check
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  featured ? "text-wengz-yellow" : "text-[#690DD4]"
                                )}
                                aria-hidden
                              />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          asChild
                          variant={featured ? "default" : "outline"}
                          className={cn(
                            "mt-auto h-11 w-full rounded-full text-sm",
                            featured
                              ? "bg-gradient-to-r from-[#690DD4] to-[#E0F840] font-semibold text-black shadow-[0_10px_30px_rgba(105,13,212,0.28)] hover:opacity-95"
                              : "border-border bg-transparent font-medium text-foreground hover:bg-muted"
                          )}
                        >
                          <Link href="/auth/register">{t("landing.pricing.cta")}</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              <div className="relative flex">
                <div className="relative flex h-full w-full flex-col rounded-[1.75rem] border border-dashed border-[#690DD4]/40 bg-background/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#690DD4]/65 sm:p-7">
                  <div className="mb-5 flex min-h-[1.75rem] items-center">
                    <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      {t("landing.pricing.custom.name")}
                    </h3>
                  </div>

                  <div className="mb-5">
                    <div className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      {t("landing.pricing.custom.priceLabel")}
                    </div>
                    <p className="mt-2 text-sm font-medium text-muted-foreground">
                      {t("landing.pricing.custom.creditsLabel")}
                    </p>
                  </div>

                  <p className="mb-5 text-sm leading-6 text-muted-foreground">
                    {t("landing.pricing.custom.description")}
                  </p>

                  <ul className="mb-7 flex flex-1 flex-col gap-2.5">
                    {(t.raw("landing.pricing.custom.features") as string[]).map(
                      (feature, featureIdx) => (
                        <li
                          key={`custom-pkg-${featureIdx}`}
                          className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#690DD4]" aria-hidden />
                          <span>{feature}</span>
                        </li>
                      )
                    )}
                  </ul>

                  <Button
                    asChild
                    variant="outline"
                    className="mt-auto h-11 w-full rounded-full border-border bg-transparent text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Link href="/contact">{t("landing.pricing.custom.cta")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative w-full border-t border-border bg-background py-12 sm:py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(105,13,212,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(224,248,64,0.06),transparent_55%)]" />
          <div className="container relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-foreground sm:mb-6`}>
                {t("landing.cta.heading")}
              </h2>
              <p className={`${FONT_SIZES.body.normal} mb-8 sm:mb-10`}>
                {t("landing.cta.subheading")}
              </p>

              <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
                <Button
                  asChild
                  className="h-11 w-full rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-8 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(105,13,212,0.25)] hover:opacity-95 sm:w-auto sm:px-10"
                >
                  <Link href="/auth/register">{t("landing.cta.primary")}</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-full border-border bg-transparent px-8 text-sm font-medium text-foreground hover:bg-muted sm:w-auto sm:px-10"
                >
                  <Link href="#pricing">{t("landing.cta.viewPlans")}</Link>
                </Button>
              </div>

              <div className="mt-12 flex flex-col items-center gap-5 sm:mt-14 sm:gap-6">
                <div className="flex w-full max-w-sm items-center gap-2 sm:gap-3">
                  <span
                    className="h-px min-w-4 flex-1 bg-gradient-to-r from-transparent to-wengz-yellow-line"
                    aria-hidden
                  />
                  <p className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-wengz-yellow sm:gap-2.5 sm:text-[0.9375rem] sm:tracking-[0.18em]">
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      <span className="absolute inset-0 animate-ping rounded-full bg-wengz-yellow opacity-55" />
                      <span className="relative m-auto h-2 w-2 rounded-full bg-wengz-yellow shadow-[0_0_12px_var(--wengz-yellow-muted)]" />
                    </span>
                    {t("landing.cta.appComingSoon")}
                  </p>
                  <span
                    className="h-px min-w-4 flex-1 bg-gradient-to-l from-transparent to-wengz-yellow-line"
                    aria-hidden
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  <AppStoreBadge
                    eyebrow={t("landing.cta.appStoreEyebrow")}
                    label={t("landing.cta.appStoreLabel")}
                  />
                  <GooglePlayBadge
                    eyebrow={t("landing.cta.googlePlayEyebrow")}
                    label={t("landing.cta.googlePlayLabel")}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 overflow-hidden border-t border-border bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(105,13,212,0.10),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(224,248,64,0.07),transparent_45%)]"
        />

        <div className="container relative mx-auto max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
          <div className="grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
            <div className="flex flex-col items-start gap-5">
              <BrandLogo tone="auto" className="h-7 sm:h-8" />
              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                {t("landing.footer.tagline")}
              </p>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("landing.footer.socialLabel")}
                </p>
                <ul className="flex flex-wrap items-center gap-2">
                  {FOOTER_SOCIAL.map((item, index) => (
                    <li key={item.key}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t(item.labelKey)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/60 text-foreground transition-colors hover:border-[#690DD4]/40 hover:bg-muted hover:text-[#690DD4]"
                      >
                        <SocialIcon name={item.key} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("landing.footer.explore")}
              </p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {LANDING_NAV_LINKS.map((item) => (
                  <li key={item.href}>
                    <LandingNavLink
                      href={item.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t(item.labelKey)}
                    </LandingNavLink>
                  </li>
                ))}
                <li>
                  <Link
                    href="/auth/register"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("landing.footer.getStarted")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/forms/provider"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("landing.footer.creators")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("landing.footer.company")}
              </p>
              <ul className="flex flex-col gap-2.5 text-sm">
                <li>
                  <Link
                    href="/contact"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("landing.footer.contact")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("landing.footer.privacy")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("landing.footer.terms")}
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:info@wengz.tech"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("landing.footer.email")}
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    dir="ltr"
                  >
                    {t("landing.footer.phone")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/80 pt-6 sm:mt-14 sm:flex-row sm:items-center">
            <FooterCopyright
              label={t("landing.footer.copyright", { year: new Date().getFullYear() })}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                {t("landing.footer.privacy")}
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                {t("landing.footer.terms")}
              </Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                {t("landing.footer.contact")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
