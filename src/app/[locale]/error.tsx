"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

export default function LocaleError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const t = useTranslations("errors");

  useEffect(() => {
    const message = `${error.name} ${error.message}`.toLowerCase();
    const isStaleDeploy =
      error.name === "ChunkLoadError" ||
      message.includes("loading chunk") ||
      message.includes("failed to fetch dynamically imported module") ||
      message.includes("/_next/static/");

    if (!isStaleDeploy) return;

    try {
      const key = "wengz:error-boundary-reload";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    } catch {
      // fall through to manual recovery UI
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <BrandLogo className="h-10" />
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold">{t("deployment.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("deployment.description")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          {t("deployment.reload")}
        </Button>
        <Button variant="outline" onClick={() => reset()}>
          {t("deployment.tryAgain")}
        </Button>
      </div>
    </div>
  );
}
