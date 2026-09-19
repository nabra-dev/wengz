import { SITE_NAME, SITE_URL, absoluteUrl, brandName } from "@/lib/seo";

type JsonLdProps = {
  readonly locale: string;
};

function JsonLdScript({ data }: { readonly data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization + WebSite schema for the marketing site. */
export function SiteJsonLd({ locale }: JsonLdProps) {
  const name = brandName(locale);
  const home = absoluteUrl("/", locale);
  const isArabic = locale === "ar";

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: ["وينجز", name],
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo-color.png`,
    email: "info@wengz.tech",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "info@wengz.tech",
        availableLanguage: ["English", "Arabic"],
      },
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: home,
    inLanguage: isArabic ? "ar" : "en",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <JsonLdScript data={organization} />
      <JsonLdScript data={website} />
    </>
  );
}

type ServiceJsonLdProps = JsonLdProps & {
  readonly path?: string;
};

/** Service / Offer catalog hints for the landing page. */
export function LandingServiceJsonLd({ locale, path = "/" }: ServiceJsonLdProps) {
  const isArabic = locale === "ar";
  const name = brandName(locale);

  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name,
    url: absoluteUrl(path, locale),
    description: isArabic
      ? "منصة خدمات رقمية تربط العملاء بمبدعين محترفين عبر اشتراك قائم على الكريدت للتصميم والتطوير وإنتاج المحتوى."
      : "A digital services marketplace connecting clients with trusted creators through credit-based subscriptions for design, development, and content production.",
    areaServed: "Worldwide",
    availableLanguage: ["en", "ar"],
    serviceType: [
      "Graphic design",
      "Web development",
      "Video production",
      "Social media content",
      "Digital marketing",
    ],
  };

  return <JsonLdScript data={data} />;
}
