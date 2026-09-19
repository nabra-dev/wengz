import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/components/seo/legal-document";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });

  return buildPageMetadata({
    locale,
    path: "/privacy",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const sectionKeys = ["who", "data", "use", "share", "rights", "contact"] as const;

  return (
    <LegalDocument
      title={t("title")}
      updatedLabel={t("updated")}
      intro={t("intro")}
      backHomeLabel={tCommon("buttons.backHome")}
      sections={sectionKeys.map((key) => ({
        title: t(`sections.${key}.title`),
        body: t(`sections.${key}.body`),
      }))}
    />
  );
}
