import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicContactForm } from "@/components/forms/public-contact-form";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.contact" });

  return buildPageMetadata({
    locale,
    path: "/contact",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default function ContactPage() {
  return <PublicContactForm />;
}
