import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { Lato, Cairo } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { AuthProvider } from "@/components/providers/session-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { GtmPageView } from "@/components/analytics/gtm-page-view";
import { brandName, buildPageMetadata } from "@/lib/seo";

/** Google Tag Manager container ID */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-58DDFXLX";

const lato = Lato({
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-lato",
});

const cairo = Cairo({
  weight: ["300", "400", "600", "700", "900"],
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
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

  const messages = (await import(`../../../messages/${locale}.json`)).default;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${lato.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <GoogleTagManager gtmId={GTM_ID} />
      <head>
        <script>{`try{var t=localStorage.getItem('theme');document.documentElement.classList.add(t==='light'?'light':'dark')}catch(e){}`}</script>
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <SiteJsonLd locale={locale} />
        <ThemeProvider>
          <AuthProvider>
            <TRPCProvider>
              <NextIntlClientProvider locale={locale} messages={messages}>
                <NotificationProvider>
                  <GtmPageView />
                  {children}
                  <Toaster position="top-right" richColors closeButton />
                  <PWAInstallPrompt />
                </NotificationProvider>
              </NextIntlClientProvider>
            </TRPCProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
