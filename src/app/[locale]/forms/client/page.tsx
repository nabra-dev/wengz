import type { Metadata } from "next";
import { ContactFormPage } from "@/components/forms/contact-form-page";
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
    path: "/forms/client",
    title: isArabic ? "نموذج العملاء" : "Client intake form",
    description: isArabic
      ? "شارك تفاصيل مشروعك وسنتواصل معك بخطة واضحة للبدء مع وينجز."
      : "Share your project details and we’ll reply with a clear plan to get started with Wengz.",
  });
}

export default function ClientFormPage() {
  return <ContactFormPage variant="client" />;
}
