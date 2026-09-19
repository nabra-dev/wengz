import type { MetadataRoute } from "next";
import {
  languageAlternates,
  PUBLIC_SEO_PATHS,
  SITE_URL,
  absoluteUrl,
  SEO_DEFAULT_LOCALE,
} from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_SEO_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path, SEO_DEFAULT_LOCALE),
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: languageAlternates(path),
    },
  }));
}

/** Absolute sitemap URL for docs / Search Console submission. */
export const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
