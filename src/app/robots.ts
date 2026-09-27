import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Crawl policy for Google Search Console and other bots.
 * Private app surfaces stay out of the index; public marketing pages are allowed.
 * Host is omitted — Google deprecated it; sitemap + canonicals define the preferred origin.
 */
export default function robots(): MetadataRoute.Robots {
  const privatePrefixes = [
    "/api/",
    "/auth/",
    "/client/",
    "/provider/",
    "/admin/",
    "/ar/auth/",
    "/ar/client/",
    "/ar/provider/",
    "/ar/admin/",
    "/sentry-tunnel",
  ];

  // Public tRPC used by the landing page during JS rendering (packages, etc.).
  // Longer Allow path wins over Disallow /api/ for Googlebot.
  const googlebotAllows = ["/api/trpc/", "/images/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePrefixes,
      },
      {
        userAgent: "Googlebot",
        allow: ["/", ...googlebotAllows],
        disallow: privatePrefixes,
      },
      {
        userAgent: "Googlebot-Image",
        allow: ["/images/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
