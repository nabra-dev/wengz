import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { Lato } from "next/font/google";
import localFont from "next/font/local";
import { GoogleTagManager } from "@next/third-parties/google";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DisplayCurrencyProvider } from "@/components/providers/display-currency-provider";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { GtmPageView } from "@/components/analytics/gtm-page-view";
import { brandName, buildPageMetadata } from "@/lib/seo";
import { pickPublicMessages } from "@/lib/i18n/message-namespaces";
import { DeploymentRecovery } from "@/components/system/deployment-recovery";

/** Only inject GTM when explicitly configured — no hardcoded fallback. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const lato = Lato({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
});

/** Arabic system font — IBM Plex Sans Arabic from `/public/fonts`. */
const ibmPlexSansArabic = localFont({
  src: [
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Thin.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-cairo",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === "ar";
  const brand = brandName(locale);
  const description = isArabic
    ? "منصة خدمات رقمية تربطك بمبدعين محترفين عبر اشتراك قائم على الكريدت للتصميم والتطوير وإنتاج المحتوى."
    : "A digital services marketplace that connects you with trusted creators through a credit-based subscription model for design, development, and content production.";

  return {
    ...buildPageMetadata({
      locale,
      path: "/",
      title: brand,
      description,
    }),
    title: {
      default: brand,
      template: `%s | ${brand}`,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const allMessages = (await import(`../../../messages/${locale}.json`)).default;
  const messages = pickPublicMessages(allMessages);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontClass = locale === "ar" ? ibmPlexSansArabic.variable : lato.variable;

  return (
    <html lang={locale} dir={dir} className={fontClass} suppressHydrationWarning>
      {GTM_ID ? <GoogleTagManager gtmId={GTM_ID} /> : null}
      <head>
        <script>{`try{var t=localStorage.getItem('theme');document.documentElement.classList.add(t==='light'?'light':'dark')}catch(e){}`}</script>
        {/* Critical: keep one brand mark visible even if the main CSS bundle fails to load after deploy. */}
        <style>{`html:not(.dark) .brand-logo-dark{display:none!important}html.dark .brand-logo-light{display:none!important}`}</style>
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <SiteJsonLd locale={locale} />
        <ThemeProvider>
          <DisplayCurrencyProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              {GTM_ID ? <GtmPageView /> : null}
              <DeploymentRecovery />
              {children}
              <Toaster position="top-right" richColors closeButton />
              <PWAInstallPrompt />
            </NextIntlClientProvider>
          </DisplayCurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
