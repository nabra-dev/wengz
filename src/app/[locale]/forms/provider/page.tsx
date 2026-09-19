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
    path: "/forms/provider",
    title: isArabic ? "نموذج المبدعين" : "Creator application form",
    description: isArabic
      ? "قدّم بياناتك ومعرض أعمالك للانضمام إلى مجتمع مبدعي وينجز."
      : "Apply with your details and portfolio to join the Wengz creator community.",
  });
}

export default function ProviderFormPage() {
  return <ContactFormPage />;
}
