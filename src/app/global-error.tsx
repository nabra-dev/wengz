"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    Sentry.captureException(error);

    const message = `${error.name} ${error.message}`.toLowerCase();
    const isStaleDeploy =
      error.name === "ChunkLoadError" ||
      message.includes("loading chunk") ||
      message.includes("failed to fetch dynamically imported module") ||
      message.includes("/_next/static/");

    if (!isStaleDeploy) return;

    try {
      const key = "wengz:global-error-reload";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    } catch {
      // show manual recovery UI
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 24 }}>
            A new version may have just deployed. Reload to get the latest app.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                borderRadius: 8,
                padding: "10px 16px",
                background: "#690DD4",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                borderRadius: 8,
                padding: "10px 16px",
                background: "transparent",
                color: "#fafafa",
                border: "1px solid #333",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
