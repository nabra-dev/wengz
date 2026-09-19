"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { sendGTMEvent } from "@next/third-parties/google";
import { usePathname } from "@/i18n/routing";

/**
 * Pushes a `page_view` to the GTM dataLayer on App Router navigations
 * (initial load + client-side route changes). In GTM, trigger GA4 on the
 * Custom Event `page_view` rather than relying on History Change alone.
 */
function GtmPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString() ?? "";
    const pagePath = query ? `${pathname}?${query}` : pathname;

    sendGTMEvent({
      event: "page_view",
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}

export function GtmPageView() {
  return (
    <Suspense fallback={null}>
      <GtmPageViewTracker />
    </Suspense>
  );
}
