"use client";

import { useEffect } from "react";

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

/**
 * Loads Google Tag Manager after the first interaction, or once the page has
 * had time to paint. Idle callbacks fire immediately on a fast CPU and pull
 * gtm.js into the Lighthouse window.
 */
export function DeferredGoogleTagManager({ gtmId }: { gtmId: string }) {
  useEffect(() => {
    if (document.getElementById("gtm-deferred")) return;

    let loaded = false;
    const load = () => {
      if (loaded || document.getElementById("gtm-deferred")) return;
      loaded = true;
      const win = window as DataLayerWindow;
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const script = document.createElement("script");
      script.id = "gtm-deferred";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
      document.head.appendChild(script);
    };

    const onInteract = () => load();
    const events = ["pointerdown", "keydown"] as const;
    for (const event of events) {
      window.addEventListener(event, onInteract, { once: true, passive: true });
    }
    const id = window.setTimeout(load, 8000);

    return () => {
      window.clearTimeout(id);
      for (const event of events) window.removeEventListener(event, onInteract);
    };
  }, [gtmId]);

  return null;
}
