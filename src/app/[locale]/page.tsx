import type { Metadata } from "next";
import { LandingServiceJsonLd } from "@/components/seo/json-ld";
import { LandingClient } from "@/components/landing/landing-client";
import { HERO_AVIF_SRCSET, HERO_SIZES } from "@/components/landing/hero-image";
import { buildPageMetadata } from "@/lib/seo";
import { getPublicPackages } from "@/lib/public-packages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === "ar";

  return buildPageMetadata({
    locale,
    path: "/",
    title: isArabic ? "منصة الخدمات الرقمية" : "Digital Services Marketplace",
    description: isArabic
      ? "احصل على خدمات تصميم وتطوير وإنتاج محتوى عبر مبدعين موثوقين وباشتراك مرن قائم على الكريدت."
      : "Get design, development, and content services from trusted creators with flexible credit-based subscriptions.",
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Prefetch packages on the server so Googlebot (and users) get pricing HTML
  // without needing a client XHR to /api/trpc (disallowed for most bots).
  const initialPackages = await getPublicPackages().catch(() => []);

  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/images/hero/hero-1080.avif"
        imageSrcSet={HERO_AVIF_SRCSET}
        imageSizes={HERO_SIZES}
        type="image/avif"
        fetchPriority="high"
      />
      <LandingServiceJsonLd locale={locale} />
      <LandingClient initialPackages={initialPackages} />
    </>
  );
}
