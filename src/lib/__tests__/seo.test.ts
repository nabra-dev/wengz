import {
  absoluteUrl,
  brandName,
  buildPageMetadata,
  canonicalPath,
  languageAlternates,
  SITE_URL,
} from "@/lib/seo";

describe("seo helpers", () => {
  it("builds locale-aware absolute URLs with as-needed prefix", () => {
    expect(absoluteUrl("/", "en")).toBe(SITE_URL);
    expect(absoluteUrl("/", "ar")).toBe(`${SITE_URL}/ar`);
    expect(absoluteUrl("/forms/provider", "en")).toBe(`${SITE_URL}/forms/provider`);
    expect(absoluteUrl("/forms/provider", "ar")).toBe(`${SITE_URL}/ar/forms/provider`);
  });

  it("builds canonical paths and hreflang maps", () => {
    expect(canonicalPath("/privacy", "en")).toBe("/privacy");
    expect(canonicalPath("/privacy", "ar")).toBe("/ar/privacy");
    expect(languageAlternates("/contact")).toEqual({
      "x-default": `${SITE_URL}/contact`,
      en: `${SITE_URL}/contact`,
      ar: `${SITE_URL}/ar/contact`,
    });
    expect(languageAlternates("/")).toEqual({
      "x-default": SITE_URL,
      en: SITE_URL,
      ar: `${SITE_URL}/ar`,
    });
  });

  it("returns localized brand and page metadata with x-default", () => {
    expect(brandName("ar")).toBe("وينجز");
    const meta = buildPageMetadata({
      locale: "en",
      path: "/terms",
      title: "Terms",
      description: "Terms of service",
    });
    expect(meta.alternates?.canonical).toBe("/terms");
    expect(meta.alternates?.languages).toEqual({
      "x-default": "/terms",
      en: "/terms",
      ar: "/ar/terms",
    });
    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });
});
