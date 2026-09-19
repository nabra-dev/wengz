import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LegalDocument } from "@/components/seo/legal-document";
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

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.contact" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <LegalDocument
      title={t("title")}
      updatedLabel={t("updated")}
      intro={t("intro")}
      backHomeLabel={tCommon("buttons.backHome")}
      sections={[
        { title: t("sections.email.title"), body: t("sections.email.body") },
        { title: t("sections.forms.title"), body: t("sections.forms.body") },
      ]}
    >
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/forms/client"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("ctaClient")}
        </Link>
        <Link
          href="/forms/provider"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
        >
          {t("ctaProvider")}
        </Link>
        <a
          href="mailto:info@wengz.tech"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
        >
          info@wengz.tech
        </a>
      </div>
    </LegalDocument>
  );
}
