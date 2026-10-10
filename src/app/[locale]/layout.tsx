import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { ThemeProvider, type Theme } from "@/components/providers/theme-provider";
import { DisplayCurrencyProvider } from "@/components/providers/display-currency-provider";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { DeferredGoogleTagManager } from "@/components/analytics/deferred-gtm";
import { GtmPageView } from "@/components/analytics/gtm-page-view";
import { FloatingWhatsApp } from "@/components/marketing/floating-whatsapp";
import { brandName, buildPageMetadata } from "@/lib/seo";
import { pickPublicMessages } from "@/lib/i18n/message-namespaces";
import { DeploymentRecovery } from "@/components/system/deployment-recovery";
import { LocaleHtmlUpdater } from "@/components/system/locale-html-updater";
import { cn } from "@/lib/utils";

/** Only inject GTM when explicitly configured — no hardcoded fallback. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/** Weights the UI sets (400–700), subset woff2. preload is off so they do not outrank the hero. */
const unbounded = localFont({
  src: [
    {
      path: "../../../public/fonts/Unbounded-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/Unbounded-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/Unbounded-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/Unbounded-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-unbounded",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

/** Arabic UI — same weight cut as Unbounded. */
const ibmPlexSansArabic = localFont({
  src: [
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/IBMPlexSansArabic-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-cairo",
  display: "swap",
  preload: false,
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
    ? "خليك مع وينجز و انجز. منصة ذكاء اصطناعي بأيادي بشرية—ابعت طلبك، يوصل للمبدع المناسب (ديزاين، فيديو، فويس، وغيره) ويشتغل مع الـ AI عشان أفضل نتيجة."
    : "Stick with Wengz & get it done. AI with human expertise—send a request, the right pro (design, video, voice, and more) crafts it with AI for stronger results.";

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
  const fontClass = locale === "ar" ? ibmPlexSansArabic.variable : unbounded.variable;

  const themeCookie = (await cookies()).get("theme")?.value;
  const initialTheme: Theme = themeCookie === "light" ? "light" : "dark";

  return (
    <html lang={locale} dir={dir} className={cn(fontClass, initialTheme)} suppressHydrationWarning>
      <head>
        {/* Critical: keep one brand mark visible even if the main CSS bundle fails to load after deploy. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html:not(.dark) .brand-logo-dark{display:none!important}html.dark .brand-logo-light{display:none!important}",
          }}
        />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <SiteJsonLd locale={locale} />
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        ) : null}
        <ThemeProvider initialTheme={initialTheme}>
          <DisplayCurrencyProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              {GTM_ID ? <DeferredGoogleTagManager gtmId={GTM_ID} /> : null}
              {GTM_ID ? <GtmPageView /> : null}
              <DeploymentRecovery />
              <LocaleHtmlUpdater locale={locale} />
              {children}
              <FloatingWhatsApp />
              <Toaster position="top-right" richColors closeButton />
              <PWAInstallPrompt />
            </NextIntlClientProvider>
          </DisplayCurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
