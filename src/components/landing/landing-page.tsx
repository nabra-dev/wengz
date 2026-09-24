"use client";

import { Link } from "@/i18n/routing";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useRef, useMemo } from "react";
import type { ComponentType, CSSProperties } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import {
  Check,
  Zap,
  Shield,
  Clock,
  Star,
  Users,
  Loader2,
  Plus,
  ArrowUp,
  LayoutGrid,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Apple,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { setPendingRequestDescription } from "@/lib/landing-request-draft";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LazyGalleryVideo } from "@/components/landing/lazy-gallery-video";
import { ServicesBento } from "@/components/landing/services-bento";
import { PackagesCarousel } from "@/components/landing/packages-carousel";
import { InfoSection } from "@/components/landing/info-section";

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.523 9.427l1.994-3.46a.64.64 0 0 0-.24-.87.64.64 0 0 0-.87.24l-2.02 3.503a10.39 10.39 0 0 0-8.774 0L5.593 5.337a.64.64 0 0 0-.87-.24.64.64 0 0 0-.24.87l1.994 3.46C3.99 11.03 2.4 13.78 2.4 16.89h19.2c0-3.11-1.59-5.86-4.077-7.463ZM7.8 14.49a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm8.4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
    </svg>
  );
}

// Typography — dark premium landing
const FONT_SIZES = {
  hero: {
    title:
      "text-balance text-3xl font-semibold tracking-tight min-[380px]:text-4xl sm:text-5xl md:text-5xl lg:text-6xl",
    subtitle:
      "text-[0.9375rem] leading-relaxed text-white/60 min-[380px]:text-base sm:text-lg",
  },
  sectionTitle: {
    primary: "text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl",
    secondary: "text-2xl sm:text-3xl md:text-4xl",
  },
  cardTitle: {
    main: "text-base sm:text-lg",
    small: "text-sm md:text-base",
  },
  body: {
    large: "text-base sm:text-lg",
    normal: "text-sm sm:text-base text-white/55",
    small: "text-xs sm:text-sm text-white/50",
  },
} as const;

type FeatureKey = "credit" | "quality" | "speed" | "revisions" | "experts";

interface Package {
  id: string;
  name: string;
  nameI18n?: Record<string, string>;
  price: number;
  credits: number;
  durationDays: number;
  description?: string;
  descriptionI18n?: Record<string, string>;
  features: string[];
  featuresI18n?: Record<string, string[]>;
  sortOrder: number;
  isFeatured?: boolean;
  services: Array<{
    serviceType: {
      id: string;
      name: string;
      nameI18n?: Record<string, string>;
      icon: string;
    };
  }>;
}

interface FeatureItem {
  icon: ComponentType<{ className?: string }>;
  key: FeatureKey;
}

const featureItems: FeatureItem[] = [
  {
    icon: Zap,
    key: "credit",
  },
  {
    icon: Shield,
    key: "quality",
  },
  {
    icon: Clock,
    key: "speed",
  },
  {
    icon: Star,
    key: "revisions",
  },
  {
    icon: Users,
    key: "experts",
  },
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5 },
  },
};

const MEET_STEP_KEYS = ["start", "work", "ship"] as const;

/** Single infinite marquee; `/images/landing/{n}.mp4` for n = 1..14 */
const GALLERY_VIDEO_INDICES = Array.from({ length: 14 }, (_, i) => i + 1);
/** Featured Works — two rows; `/images/landing/{n}.jpg` for n = 1..21 */
const GALLERY_IMAGE_ROW_A = Array.from({ length: 11 }, (_, i) => i + 1);
const GALLERY_IMAGE_ROW_B = Array.from({ length: 10 }, (_, i) => i + 12);

type HeroChatPhase = "idle" | "awaitingReply" | "showingReply" | "error";

function getVideoPlaybackLabel(locale: string, isPlaying: boolean) {
  if (isPlaying) {
    return locale === "ar" ? "إيقاف الفيديو" : "Pause video";
  }
  return locale === "ar" ? "تشغيل الفيديو" : "Play video";
}

function getVideoMuteLabel(locale: string, isMuted: boolean) {
  if (isMuted) {
    return locale === "ar" ? "إلغاء كتم الصوت" : "Unmute";
  }
  return locale === "ar" ? "كتم الصوت" : "Mute";
}

export default function LandingPage() {
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
  const [isHeroVideoReady, setIsHeroVideoReady] = useState(false);
  const [promptRotateIndex, setPromptRotateIndex] = useState(0);
  const [videoPlayingState, setVideoPlayingState] = useState<Record<number, boolean>>({});
  const [videoMutedState, setVideoMutedState] = useState<Record<number, boolean>>({});
  const [videoProgressState, setVideoProgressState] = useState<Record<number, number>>({});
  /** Each gallery video may appear twice (marquee duplicate); key `${idx}-${strip}`. */
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const heroReplyScrollRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const landingNavItems = useMemo(
    () =>
      [
        { href: "#features", label: t("landing.nav.features") },
        { href: "#gallery", label: t("landing.nav.gallery") },
        { href: "#pricing", label: t("landing.nav.pricing") },
        { href: "/forms/provider", label: t("landing.nav.providerForm") },
      ] as const,
    [t]
  );

  const { data: packagesData, isLoading: isPackagesLoading, isError: isPackagesError } =
    trpc.admin.getPublicPackages.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: true,
      retry: 2,
    });

  const packages: Package[] = packagesData ?? [];
  const showPackagesSkeleton = isPackagesLoading && packages.length === 0;

  useEffect(() => {
    // Fallback: never block hero content forever on slow networks/dev hiccups.
    const id = setTimeout(() => setIsHeroVideoReady(true), 3500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (isHeroVideoReady) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isHeroVideoReady]);

  const getLocalizedText = (
    text: string | undefined,
    i18nObj: Record<string, string> | undefined
  ) => {
    if (!i18nObj) return text || "";
    return i18nObj[locale] || text || "";
  };

  const getPackageFeatures = (pkg: Package) => {
    if (pkg.featuresI18n?.[locale]) {
      return pkg.featuresI18n[locale];
    }
    return pkg.features || [];
  };

  const promptRotations = useMemo(() => {
    const staticExamples = [
      t("landing.hero.promptRotate0"),
      t("landing.hero.promptRotate1"),
      t("landing.hero.promptRotate2"),
      t("landing.hero.promptRotate3"),
      t("landing.hero.promptRotate4"),
      t("landing.hero.promptRotate5"),
      t("landing.hero.promptRotate6"),
    ];
    return staticExamples;
  }, [t]);

  useEffect(() => {
    if (heroChatPhase !== "idle") return;
    if (heroPrompt.trim().length > 0) return;
    const len = promptRotations.length;
    if (len === 0) return;
    const id = setInterval(() => {
      setPromptRotateIndex((i) => (i + 1) % len);
    }, 4200);
    return () => clearInterval(id);
  }, [heroChatPhase, heroPrompt, promptRotations.length]);

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

  const setGalleryVideoRef = (idx: number, strip: 0 | 1) => (el: HTMLVideoElement | null) => {
    const key = `${idx}-${strip}`;
    if (el) {
      videoRefs.current[key] = el;
    } else {
      delete videoRefs.current[key];
    }
  };

  const getGalleryVideos = (idx: number): HTMLVideoElement[] =>
    ([0, 1] as const)
      .map((s) => videoRefs.current[`${idx}-${s}`])
      .filter((x): x is HTMLVideoElement => x != null);

  const toggleVideoPlayback = (idx: number) => {
    const els = getGalleryVideos(idx);
    if (els.length === 0) return;
    const anyPlaying = els.some((v) => !v.paused);
    els.forEach((el) => {
      if (anyPlaying) el.pause();
      else void el.play();
    });
  };

  const toggleVideoMute = (idx: number) => {
    const els = getGalleryVideos(idx);
    const first = els[0];
    if (!first) return;
    const nextMuted = !first.muted;
    els.forEach((el) => {
      el.muted = nextMuted;
    });
    setVideoMutedState((prev) => ({ ...prev, [idx]: nextMuted }));
  };

  const seekVideo = (idx: number, progressValue: number) => {
    const els = getGalleryVideos(idx);
    if (els.length === 0) return;
    const duration = els[0].duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const t = (progressValue / 100) * duration;
    els.forEach((el) => {
      el.currentTime = t;
    });
    setVideoProgressState((prev) => ({ ...prev, [idx]: progressValue }));
  };

  const marqueeDuration = (seconds: number): CSSProperties =>
    ({ "--landing-marquee-duration": `${seconds}s` }) as CSSProperties;

  return (
    <div
      className={`relative flex min-h-screen flex-col bg-black text-white ${isRTL ? "rtl" : "ltr"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Brand color ambience */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#690DD4]/25 blur-3xl" />
        <div className="absolute top-32 right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E0F840]/10 blur-3xl" />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed top-0 left-0 right-0 z-50 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="mx-auto mb-2 max-w-xl px-4 text-center text-[11px] text-white/45 sm:text-xs">
          {t("landing.notices.beta")}
        </div>
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex w-full max-w-4xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/55 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-5 sm:py-2.5">
            <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2">
              <BrandLogo tone="yellow" className="h-6 sm:h-7 md:h-8" priority />
            </Link>

            <nav
              className="hidden min-w-0 flex-1 items-center justify-center gap-5 md:flex lg:gap-8"
              aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary"}
            >
              {landingNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 text-sm font-medium text-white/75 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-0.5 sm:gap-1">
                <ThemeSwitcher />
                <LanguageSwitcher />
              </div>
              <Link href="/auth/register">
                <Button
                  size="sm"
                  className="h-9 rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-4 text-sm font-semibold text-black shadow-[0_8px_28px_rgba(105,13,212,0.35)] transition-all hover:opacity-95 sm:px-5"
                >
                  {t("common.buttons.getStarted")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      {isHeroVideoReady ? null : (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-8 sm:gap-10">
            <span className="sr-only">{locale === "ar" ? "جاري التحميل" : "Loading"}</span>
            <BrandLogo tone="yellow" className="h-16 sm:h-24 md:h-28" />
            <div className="flex items-center gap-3 sm:gap-4" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="landing-loader-dot h-4 w-4 rounded-full bg-gradient-to-br from-[#E0F840] to-[#690DD4] shadow-[0_0_14px_rgba(224,248,64,0.4)] sm:h-5 sm:w-5"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10">
        {/* Hero — full-bleed visual + left headline + glass prompt */}
        <section className="relative isolate flex min-h-landing-screen flex-col justify-end overflow-hidden pb-10 pt-[calc(6.5rem+env(safe-area-inset-top,0px))] sm:pb-14 sm:pt-[calc(7rem+env(safe-area-inset-top,0px))] md:justify-center md:pb-20">
          <div className="pointer-events-none absolute inset-0 z-0 min-h-0 overflow-hidden">
            <video
              className="absolute inset-0 h-full w-full min-h-0 scale-105 object-cover"
              src="/images/hero.mp4"
              poster="/images/landing/1.jpg"
              onLoadedData={() => setIsHeroVideoReady(true)}
              onCanPlay={() => setIsHeroVideoReady(true)}
              onError={() => setIsHeroVideoReady(true)}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              tabIndex={-1}
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/25"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50"
              aria-hidden
            />
            <div
              className="absolute inset-0 opacity-40 mix-blend-screen"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 70% 45%, rgba(105,13,212,0.45), transparent 55%)",
              }}
              aria-hidden
            />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col px-4 sm:px-6 lg:px-10">
            <div className={`max-w-xl ${textDirectionClass}`}>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={`${FONT_SIZES.hero.title} text-white`}
              >
                {t("landing.hero.titleBefore")}
                <span className="text-[#E0F840]">{t("landing.hero.titleHighlight")}</span>
                {t("landing.hero.titleAfter")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className={`mt-4 max-w-md ${FONT_SIZES.hero.subtitle}`}
              >
                {t("landing.hero.subtitle")}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mx-auto mt-10 w-full min-w-0 max-w-3xl rounded-2xl border border-white/15 bg-black/45 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:mt-14 sm:rounded-3xl sm:p-4"
            >
              <div className="relative min-h-[4.5rem]">
                {heroChatPhase === "showingReply" ? (
                  <div
                    ref={heroReplyScrollRef}
                    className={`relative z-[1] max-h-56 overflow-y-auto px-3 py-2 ${textDirectionClass}`}
                  >
                    <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                      {locale === "ar" ? "رد وينجز" : "Wengz reply"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-white">
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
                      placeholder=" "
                      rows={2}
                      className={`relative z-[1] w-full resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-transparent focus:outline-none focus:ring-0 read-only:cursor-default ${textDirectionClass}`}
                      onKeyDown={(e) => {
                        if (heroChatPhase !== "idle") return;
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleHeroSubmit();
                        }
                      }}
                      aria-label={t("landing.hero.promptPlaceholder")}
                    />
                    {heroChatPhase === "idle" && !heroPrompt && promptRotations.length > 0 && (
                      <div
                        className={`pointer-events-none absolute inset-0 z-0 flex items-start px-3 py-2 ${textDirectionClass}`}
                      >
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={promptRotateIndex}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.35 }}
                            className="line-clamp-2 text-sm text-white/45"
                          >
                            {promptRotations[promptRotateIndex % promptRotations.length]}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    )}
                    {heroChatPhase === "awaitingReply" && heroLoadingReply && (
                      <div
                        className={`pointer-events-none absolute inset-0 z-[2] flex items-center justify-center gap-2 bg-black/40 px-3 backdrop-blur-[2px] ${textDirectionClass}`}
                      >
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/60" />
                        <span className="text-sm text-white/60">
                          {locale === "ar" ? "جاري التفكير..." : "Thinking..."}
                        </span>
                      </div>
                    )}
                    {heroChatPhase === "error" && (
                      <p
                        className={`relative z-[1] px-3 pb-2 text-sm text-red-400 ${textDirectionClass}`}
                      >
                        {locale === "ar"
                          ? "تعذر توليد الرد. حدّث الصفحة للمحاولة مرة أخرى."
                          : "Could not generate a reply. Refresh the page to try again."}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div
                className={`flex flex-nowrap items-center justify-between gap-2 border-t border-white/10 px-1.5 pb-1 pt-2 sm:px-2 ${
                  heroChatPhase === "idle" ? "" : "opacity-60"
                }`}
              >
                <div className="group relative shrink-0">
                  <button
                    type="button"
                    disabled
                    aria-disabled
                    className="cursor-not-allowed rounded-full p-1.5 text-white/40 opacity-50 sm:p-2"
                    aria-label={t("landing.hero.uploadTooltip")}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  {heroChatPhase === "idle" ? (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-white/15 bg-black/90 px-2.5 py-1.5 text-center text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                    >
                      {t("landing.hero.uploadTooltip")}
                    </span>
                  ) : null}
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
                    aria-label={t("common.buttons.getStarted")}
                  >
                    {heroLoadingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <ServicesBento />
        <PackagesCarousel
          packages={packages}
          isLoading={showPackagesSkeleton}
          isError={isPackagesError}
        />
        <InfoSection />

        {/* Provider form CTA */}
        <section className="relative w-full border-t border-white/10 bg-black py-16 sm:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(105,13,212,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(224,248,64,0.06),transparent_55%)]" />

          <div className="container relative z-10 px-4 sm:px-6">
            <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-[#690DD4]/[0.12] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-10 md:p-12">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#690DD4]/55 to-transparent opacity-80" />

              <div className="flex flex-col items-center text-center">
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#690DD4]/30 to-[#E0F840]/20 ring-1 ring-white/10 shadow-inner"
                  aria-hidden
                >
                  <Sparkles className="h-5 w-5 text-white/90" strokeWidth={1.75} />
                </div>
                <h2 className={`${FONT_SIZES.sectionTitle.secondary} mb-3 text-white`}>
                  {t("landing.forms.heading")}
                </h2>
                <p className={`${FONT_SIZES.body.normal} max-w-xl`}>
                  {t("landing.forms.subheading")}
                </p>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/50 sm:text-[0.9375rem]">
                  {t("landing.forms.provider.description")}
                </p>
                <div className="mt-8">
                  <Link href="/forms/provider">
                    <Button className="h-11 rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-8 text-sm font-semibold text-black shadow-[0_10px_32px_rgba(105,13,212,0.3)] transition-all hover:-translate-y-0.5 hover:opacity-95">
                      {t("landing.forms.provider.cta")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Meet — three steps */}
        <section className="relative border-t border-white/10 bg-black py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight text-white sm:mb-14 sm:text-4xl">
              {t("landing.meet.heading")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              {MEET_STEP_KEYS.map((key) => (
                <motion.div
                  key={key}
                  className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#690DD4]/55 to-transparent opacity-70" />
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-[#690DD4]/10 via-transparent to-[#E0F840]/10 opacity-0 transition-opacity group-hover:opacity-100" />
                  <h3 className="mb-2 text-base font-medium text-white">
                    {t(`landing.meet.steps.${key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/50">
                    {t(`landing.meet.steps.${key}.description`)}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="relative w-full border-t border-white/10 bg-black py-16 sm:py-24 md:py-32"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(105,13,212,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(224,248,64,0.06),transparent_55%)]" />
          <div className="container relative z-10 px-4 sm:px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="mb-12 sm:mb-16 md:mb-20 text-center"
            >
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-white sm:mb-6`}>
                {t("landing.features.heading")}
                <br className="hidden sm:block" />
                <span
                  className={`mt-2 block font-normal text-white/55 sm:mt-4 ${FONT_SIZES.body.large}`}
                >
                  {t("landing.features.subheading")}
                </span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5"
            >
              {featureItems.map((feature) => {
                const Icon = feature.icon;
                const title = t(`landing.features.${feature.key}.title`);
                const description = t(`landing.features.${feature.key}.description`);

                return (
                  <motion.div
                    key={feature.key}
                    variants={scaleIn}
                    whileHover={{ y: -4, transition: { duration: 0.25 } }}
                    className="group relative flex min-h-0 min-w-0 w-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-[#E0F840]/30 sm:p-4"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E0F840]/50 to-transparent opacity-60" />
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#690DD4]/25 to-[#E0F840]/20 sm:h-12 sm:w-12">
                      <Icon className="h-5 w-5 text-white/90 transition-transform duration-300 group-hover:scale-110 sm:h-6 sm:w-6" />
                    </div>
                    <h3
                      className={`${FONT_SIZES.cardTitle.small} mb-2 font-medium capitalize text-white`}
                    >
                      {title}
                    </h3>
                    <p className={`${FONT_SIZES.body.small}`}>{description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Gallery: infinite video marquee + dual-row image marquees */}
        <section
          id="gallery"
          className="relative w-full overflow-hidden border-t border-white/10 bg-black py-16 sm:py-24 md:py-32"
        >
          <div className="container px-4 sm:px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="mb-8 text-center sm:mb-12"
            >
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-white sm:mb-6`}>
                {t("landing.gallery.videos.heading")}
              </h2>
              <p className={FONT_SIZES.body.normal}>{t("landing.gallery.videos.subheading")}</p>
            </motion.div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mt-8 w-full"
          >
            <div className="relative w-full overflow-hidden py-1" dir="ltr">
              <div
                className="flex w-max gap-3 sm:gap-4 md:gap-5 animate-landing-marquee hover:[animation-play-state:paused]"
                style={marqueeDuration(70)}
              >
                {[0, 1].map((strip) => (
                  <div key={`vstrip-${strip}`} className="flex shrink-0 gap-3 sm:gap-4 md:gap-5">
                    {GALLERY_VIDEO_INDICES.map((idx) => (
                      <div
                        key={`landing-video-${idx}-${strip}`}
                        className="w-[42vw] max-w-[12rem] shrink-0 sm:w-48 sm:max-w-none md:w-52"
                      >
                        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#111] sm:rounded-3xl">
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(224,248,64,0.16),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(105,13,212,0.14),transparent_55%)]" />
                          <LazyGalleryVideo
                            className="aspect-[9/16] w-full object-cover"
                            src={`/images/landing/${idx}.mp4`}
                            videoRef={setGalleryVideoRef(idx, strip as 0 | 1)}
                            muted={videoMutedState[idx] ?? true}
                            onClick={() => {
                              toggleVideoPlayback(idx);
                            }}
                            onLoadedMetadata={
                              strip === 0
                                ? (event) => {
                                    const target = event.currentTarget;
                                    setVideoMutedState((prev) => ({
                                      ...prev,
                                      [idx]: target.muted,
                                    }));
                                    setVideoProgressState((prev) => ({
                                      ...prev,
                                      [idx]: 0,
                                    }));
                                  }
                                : undefined
                            }
                            onPlay={
                              strip === 0
                                ? () => {
                                    setVideoPlayingState((prev) => ({
                                      ...prev,
                                      [idx]: true,
                                    }));
                                  }
                                : undefined
                            }
                            onPause={
                              strip === 0
                                ? () => {
                                    setVideoPlayingState((prev) => ({
                                      ...prev,
                                      [idx]: false,
                                    }));
                                  }
                                : undefined
                            }
                            onTimeUpdate={
                              strip === 0
                                ? (event) => {
                                    const target = event.currentTarget;
                                    if (!Number.isFinite(target.duration) || target.duration <= 0)
                                      return;
                                    const nextProgress =
                                      (target.currentTime / target.duration) * 100;
                                    setVideoProgressState((prev) => ({
                                      ...prev,
                                      [idx]: nextProgress,
                                    }));
                                  }
                                : undefined
                            }
                          />

                          <div
                            className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={videoProgressState[idx] ?? 0}
                                onChange={(event) => {
                                  seekVideo(idx, Number(event.target.value));
                                }}
                                className="h-1 w-full cursor-pointer appearance-none bg-transparent accent-[#E0F840]"
                                aria-label={locale === "ar" ? "تقدم الفيديو" : "Video progress"}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  toggleVideoPlayback(idx);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                                aria-label={getVideoPlaybackLabel(
                                  locale,
                                  videoPlayingState[idx] ?? false
                                )}
                              >
                                {videoPlayingState[idx] ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  toggleVideoMute(idx);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                                aria-label={getVideoMuteLabel(locale, videoMutedState[idx] ?? true)}
                              >
                                {(videoMutedState[idx] ?? true) ? (
                                  <VolumeX className="h-4 w-4" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="container relative z-10 mt-16 px-4 sm:mt-20 sm:px-6 md:mt-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="mb-8 text-center sm:mb-12"
            >
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-white sm:mb-6`}>
                {t("landing.gallery.images.heading")}
              </h2>
              <p className={FONT_SIZES.body.normal}>{t("landing.gallery.images.subheading")}</p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="flex flex-col gap-8 sm:gap-10"
            >
              {[GALLERY_IMAGE_ROW_A, GALLERY_IMAGE_ROW_B].map((rowIndices) => {
                const imgRowKey = rowIndices.join("-");
                const isFirstImgRow = rowIndices === GALLERY_IMAGE_ROW_A;
                return (
                  <div
                    key={`image-marquee-${imgRowKey}`}
                    className="relative w-full overflow-hidden py-1"
                    dir="ltr"
                  >
                    <div
                      className={
                        isFirstImgRow
                          ? "flex w-max gap-3 sm:gap-4 md:gap-5 animate-landing-marquee"
                          : "flex w-max gap-3 sm:gap-4 md:gap-5 animate-landing-marquee-reverse"
                      }
                      style={marqueeDuration(isFirstImgRow ? 58 : 64)}
                    >
                      {[0, 1].map((strip) => (
                        <div
                          key={`imgstrip-${imgRowKey}-${strip}`}
                          className="flex shrink-0 gap-3 sm:gap-4 md:gap-5"
                        >
                          {rowIndices.map((n) => (
                            <div
                              key={`landing-img-${imgRowKey}-${n}-${strip}`}
                              className="group relative aspect-[4/5] w-[38vw] max-w-[11rem] shrink-0 overflow-hidden rounded-lg border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_18px_70px_rgba(0,0,0,0.55)] sm:w-44 sm:max-w-none md:w-48 sm:rounded-xl"
                            >
                              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-[linear-gradient(135deg,rgba(105,13,212,0.18),transparent_45%),linear-gradient(315deg,rgba(224,248,64,0.16),transparent_45%)]" />
                              <Image
                                src={`/images/landing/${n}.jpg`}
                                alt={`Portfolio ${n}`}
                                fill
                                sizes="(max-width: 640px) 40vw, 12rem"
                                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="relative w-full border-t border-white/10 bg-black py-16 sm:py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(105,13,212,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(224,248,64,0.06),transparent_55%)]" />
          <div className="container relative z-10 px-4 sm:px-6">
            <div className="grid grid-cols-1 items-center gap-8 sm:gap-12 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="flex justify-center"
              >
                <BrandLogo tone="yellow" className="h-24 sm:h-32 md:h-40" />
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={staggerContainer}
              >
                <p className="mb-3 text-sm text-white/50">{t("landing.stats.subheading")}</p>
                <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-8 text-white sm:mb-12`}>
                  {t("landing.stats.heading")}
                </h2>

                <div className="grid grid-cols-2 gap-3 min-w-0 sm:gap-6">
                  {[
                    { num: "4.9", labelKey: "landing.stats.happyClients" },
                    { num: "+500", labelKey: "landing.stats.expertCreators" },
                    { num: "100%", labelKey: "landing.stats.qualityScore" },
                    { num: "+31", labelKey: "landing.stats.portfolioItems" },
                  ].map((stat) => (
                    <motion.div
                      key={`stat-${stat.labelKey}`}
                      variants={fadeInUp}
                      className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#E0F840]/30 sm:rounded-3xl sm:p-6"
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#690DD4]/55 to-transparent opacity-60" />
                      <div className="mb-2 text-2xl font-semibold tracking-tight bg-gradient-to-r from-[#E0F840] to-[#690DD4] bg-clip-text text-transparent sm:text-3xl">
                        {stat.num}
                      </div>
                      <p className={`${FONT_SIZES.body.small}`}>{t(stat.labelKey)}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="relative w-full border-t border-white/10 bg-black py-16 sm:py-24 md:py-32"
        >
          <div className="container relative z-10 px-4 sm:px-6">
            <div className="mb-12 sm:mb-16 text-center">
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-white sm:mb-6`}>
                {t("landing.pricing.heading")}
              </h2>
              <p className={FONT_SIZES.body.normal}>{t("landing.pricing.subheading")}</p>
            </div>

            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 pt-2 sm:gap-8 sm:pt-3 md:grid-cols-2 lg:grid-cols-4">
              {showPackagesSkeleton && (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                </div>
              )}
              {!showPackagesSkeleton && isPackagesError && (
                <p className="col-span-full py-8 text-center text-sm text-white/50">
                  {t("landing.pricing.loadError")}
                </p>
              )}
              {!showPackagesSkeleton && !isPackagesError && packages.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-white/50">
                  {t("landing.pricing.empty")}
                </p>
              )}
              {!showPackagesSkeleton &&
                packages.length > 0 &&
                packages.map((pkg) => {
                  return (
                    <div
                      key={pkg.id}
                      className="group relative transition-transform duration-200 hover:-translate-y-1"
                    >
                      <div
                        className={`relative flex h-full flex-col overflow-visible rounded-2xl border bg-black p-6 transition-all duration-300 hover:shadow-[0_22px_90px_rgba(0,0,0,0.55)] sm:rounded-3xl sm:p-8 ${
                          pkg.isFeatured
                            ? "border-[#E0F840]/40 shadow-[0_0_0_1px_rgba(224,248,64,0.12)] hover:border-[#E0F840]/55"
                            : "border-white/10 hover:border-[#690DD4]/40"
                        }`}
                      >
                        {pkg.isFeatured ? (
                          <div className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 sm:-top-3.5">
                            <Badge className="relative border border-white/25 bg-[#690DD4] px-4 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#E0F840] shadow-[0_10px_28px_rgba(105,13,212,0.45),0_2px_8px_rgba(224,248,64,0.35)] ring-2 ring-black">
                              {t("landing.pricing.featuredBadge")}
                            </Badge>
                          </div>
                        ) : null}
                        <h3
                          className={`${FONT_SIZES.cardTitle.main} mb-2 font-semibold text-white text-center`}
                        >
                          {getLocalizedText(pkg.name, pkg.nameI18n)}
                        </h3>
                        <p className={`${FONT_SIZES.body.small} mb-6 flex-grow text-center`}>
                          {pkg.credits} {t("common.credits")}
                        </p>

                        <div className="mb-6 h-px w-full bg-gradient-to-r from-[#690DD4]/35 via-white/10 to-[#E0F840]/35" />

                        <div className="mb-6">
                          <div className="mb-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl text-center">
                            {formatCurrency(pkg.price)}
                          </div>
                          <p className={`${FONT_SIZES.body.small} text-center`}>
                            {t("landing.pricing.perMonth")}
                          </p>
                        </div>

                        <ul className="space-y-2 sm:space-y-3 mb-8 flex-grow">
                          {getPackageFeatures(pkg)
                            .slice(0, 4)
                            .map((feature, featureIdx) => (
                              <li
                                key={`${pkg.id}-${featureIdx}`}
                                className={`flex items-start gap-2 ${FONT_SIZES.body.small}`}
                              >
                                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/40" />
                                <span>{feature}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative w-full border-t border-white/10 bg-black py-16 sm:py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(105,13,212,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(224,248,64,0.06),transparent_55%)]" />
          <div className="container relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scaleIn}
              className="text-center"
            >
              <h2 className={`${FONT_SIZES.sectionTitle.primary} mb-4 text-white sm:mb-6`}>
                {t("landing.cta.heading")}
              </h2>
              <p className={`${FONT_SIZES.body.normal} mb-8 sm:mb-10`}>
                {t("landing.cta.subheading")}
              </p>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
              >
                <Link href="/auth/register">
                  <Button className="h-11 rounded-full bg-gradient-to-r from-[#690DD4] to-[#E0F840] px-8 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(105,13,212,0.25)] hover:opacity-95 sm:px-10">
                    {t("common.buttons.getStarted")}
                  </Button>
                </Link>
                <Link href="#pricing">
                  <Button
                    variant="outline"
                    className="h-11 rounded-full border-white/20 bg-transparent px-8 text-sm font-medium text-white hover:bg-white/5 sm:px-10"
                  >
                    {t("landing.cta.viewPlans")}
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-12 flex items-start justify-center gap-12 sm:mt-14 sm:gap-16"
              >
                <div className="flex flex-col items-center gap-2.5">
                  <span className="flex h-12 w-12 items-center justify-center text-white">
                    <Apple className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                    <span className="sr-only">{t("landing.cta.iosApp")}</span>
                  </span>
                  <span className="text-xs text-white/45 sm:text-sm">
                    {t("landing.cta.appComingSoon")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2.5">
                  <span className="flex h-12 w-12 items-center justify-center text-white">
                    <AndroidIcon className="h-8 w-8" />
                    <span className="sr-only">{t("landing.cta.androidApp")}</span>
                  </span>
                  <span className="text-xs text-white/45 sm:text-sm">
                    {t("landing.cta.appComingSoon")}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <motion.footer
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="relative z-10 border-t border-white/10 bg-black py-10 sm:py-12"
      >
        <div className="container flex w-full flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center md:gap-8">
          <div className="flex shrink-0 items-center gap-2">
            <BrandLogo tone="yellow" className="h-6 sm:h-7 md:h-8" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/45 md:justify-end">
            <Link href="/privacy" className="transition-colors hover:text-white">
              {t("common.footer.privacy")}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              {t("common.footer.terms")}
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white">
              {t("common.footer.contact")}
            </Link>
          </div>

          <p className="text-xs text-white/40 sm:text-sm">{t("common.footer.copyright")}</p>
        </div>
      </motion.footer>
    </div>
  );
}
