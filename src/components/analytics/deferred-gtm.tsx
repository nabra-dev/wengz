"use client";

import { useEffect } from "react";

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

/**
 * Loads Google Tag Manager after the browser is idle so gtm.js does not
 * compete with the hero image or the first paint.
 */
export function DeferredGoogleTagManager({ gtmId }: { gtmId: string }) {
  useEffect(() => {
    if (document.getElementById("gtm-deferred")) return;

    const load = () => {
      if (document.getElementById("gtm-deferred")) return;
      const win = window as DataLayerWindow;
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const script = document.createElement("script");
      script.id = "gtm-deferred";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
      document.head.appendChild(script);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(load, 1500);
    return () => window.clearTimeout(id);
  }, [gtmId]);

  return null;
}
