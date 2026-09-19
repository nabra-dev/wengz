import type { Metadata } from "next";

export const SITE_NAME = "Wengz";
export const SITE_NAME_AR = "وينجز";
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : "https://wengz.tech";

export const DEFAULT_OG_IMAGE = "/images/logo-color.png";

/** Keep in sync with `src/i18n/routing.ts` (avoid importing next-intl here for testability). */
export const SEO_LOCALES = ["en", "ar"] as const;
export type SeoLocale = (typeof SEO_LOCALES)[number];
export const SEO_DEFAULT_LOCALE: SeoLocale = "en";

/** Public paths that should be crawled and listed in the sitemap (no locale prefix). */
export const PUBLIC_SEO_PATHS = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/forms/provider", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.4 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.7 },
] as const;

export function isSeoLocale(value: string): value is SeoLocale {
  return (SEO_LOCALES as readonly string[]).includes(value);
}

/** Locale-aware absolute URL (respects `localePrefix: "as-needed"`). */
export function absoluteUrl(path: string, locale: string = SEO_DEFAULT_LOCALE): string {
  const normalized = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  if (locale === SEO_DEFAULT_LOCALE) {
    return `${SITE_URL}${normalized || "/"}`;
  }
  return `${SITE_URL}/${locale}${normalized}`;
}

/** Path-only canonical for Metadata.alternates (relative to metadataBase). */
export function canonicalPath(path: string, locale: string): string {
  const normalized = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  if (locale === SEO_DEFAULT_LOCALE) {
    return normalized || "/";
  }
  return `/${locale}${normalized}`;
}

/** hreflang map for a logical page (includes x-default → English). */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": absoluteUrl(path, SEO_DEFAULT_LOCALE),
  };
  for (const locale of SEO_LOCALES) {
    languages[locale] = absoluteUrl(path, locale);
  }
  return languages;
}

export function brandName(locale: string): string {
  return locale === "ar" ? SITE_NAME_AR : SITE_NAME;
}

type BuildPageMetadataInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
  index?: boolean;
  follow?: boolean;
  ogType?: "website" | "article";
};

export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  index = true,
  follow = true,
  ogType = "website",
}: BuildPageMetadataInput): Metadata {
  const brand = brandName(locale);
  const isArabic = locale === "ar";
  const canonical = canonicalPath(path, locale);
  const languages: Record<string, string> = {};
  for (const loc of SEO_LOCALES) {
    languages[loc] = canonicalPath(path, loc);
  }

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: `${title} | ${brand}`,
      description,
      url: absoluteUrl(path, locale),
      siteName: brand,
      locale: isArabic ? "ar_SA" : "en_US",
      type: ogType,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          alt: brand,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${brand}`,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index,
      follow,
      googleBot: {
        index,
        follow,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}
