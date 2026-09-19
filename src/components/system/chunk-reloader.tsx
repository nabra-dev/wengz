"use client";

import { useEffect } from "react";

/**
 * Listens for chunk load failures (often from long idle + dev server restart)
 * and forces a full reload to recover gracefully.
 */
export function ChunkReloadOnError() {
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const message = event.message || "";
      const filename = event.filename || "";
      const isChunkError =
        message.includes("Loading chunk") || filename.includes("/_next/static/chunks/");

      if (isChunkError) {

        globalThis.location?.reload();
      }
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason?.message === "string" ? reason.message : "";
      const stack = typeof reason?.stack === "string" ? reason.stack : "";
      if (typeof message === "string" && message.includes("Loading chunk")) {

        globalThis.location?.reload();
      }
      if (typeof stack === "string" && stack.includes("/_next/static/chunks/")) {

        globalThis.location?.reload();
      }
    };

    globalThis.addEventListener?.("error", handler);
    globalThis.addEventListener?.("unhandledrejection", rejectionHandler);

    return () => {
      globalThis.removeEventListener?.("error", handler);
      globalThis.removeEventListener?.("unhandledrejection", rejectionHandler);
    };
  }, []);

  return null;
}
