import type { Metadata } from "next";
import { LandingServiceJsonLd } from "@/components/seo/json-ld";
import { LandingClient } from "@/components/landing/landing-client";
import { buildPageMetadata } from "@/lib/seo";

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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <LandingServiceJsonLd locale={locale} />
      <LandingClient />
    </>
  );
}
