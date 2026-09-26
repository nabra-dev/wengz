import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo";

// Initialize notification system on server
import "@/lib/notifications/init";

const metadataBase = new URL(SITE_URL);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Wengz",
    template: "%s | Wengz",
  },
  description:
    "Stick with Wengz & get it done. AI with human expertise—send a request, the right pro (design, video, voice, and more) crafts it with AI for stronger results.",
  applicationName: "Wengz",
  keywords: [
    "Wengz",
    "وينجز",
    "AI platform",
    "human + AI",
    "creative services",
    "design",
    "video production",
    "voiceover",
    "credit-based subscription",
    "creative marketplace",
  ],
  authors: [{ name: "Wengz", url: SITE_URL }],
  creator: "Wengz",
  publisher: "Wengz",
  category: "business",
  openGraph: {
    title: "Wengz | Stick with Wengz & get it done",
    description:
      "AI with human expertise. Send a request—the right pro works AI for you and delivers a stronger result.",
    siteName: "Wengz",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA"],
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        alt: "Wengz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wengz | Stick with Wengz & get it done",
    description:
      "AI with human expertise. Send a request—the right pro works AI for you and delivers a stronger result.",
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wengz",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/images/logo.svg", type: "image/svg+xml" }, { url: "/images/icon-192.png" }],
    shortcut: "/images/logo.svg",
    apple: "/images/icon-192.png",
  },
  other: {
    "msapplication-TileColor": "#690DD4",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#690DD4" },
    { media: "(prefers-color-scheme: dark)", color: "#690DD4" },
  ],
};

/**
 * Pass-through root layout so `[locale]/layout` can own `<html lang>` / `dir`
 * (critical for bilingual SEO). Providers and fonts live in the locale layout.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
