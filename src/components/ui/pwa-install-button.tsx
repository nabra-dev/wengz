"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  canPromptPwaInstall,
  isPwaInstalled,
  promptPwaInstall,
  startPwaInstallCapture,
  subscribePwaInstall,
} from "@/lib/pwa-install";

function useCanPromptPwaInstall(): boolean {
  return useSyncExternalStore(subscribePwaInstall, canPromptPwaInstall, () => false);
}

/**
 * Landing/header control: one tap opens the native “Add to Home Screen” /
 * install sheet when the browser exposes it. No steps dialog.
 */
export function PwaInstallButton({ className }: { readonly className?: string }) {
  const t = useTranslations("pwa.install");
  const canPrompt = useCanPromptPwaInstall();
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stop = startPwaInstallCapture();
    setInstalled(isPwaInstalled());
    return stop;
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome === "accepted" || outcome === "installed") {
        setInstalled(true);
        return;
      }
      if (outcome === "unavailable") {
        // Browsers without a programmable prompt (notably iOS Safari) cannot
        // install via API — keep feedback to one short toast, no steps UI.
        toast.message(t("unavailable"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={busy}
      aria-label={t("downloadAria")}
      title={canPrompt ? t("downloadAria") : t("unavailable")}
      className={
        className ?? "h-8 w-8 shrink-0 text-foreground hover:text-foreground sm:h-9 sm:w-9"
      }
    >
      <Download className="h-4 w-4" />
      <span className="sr-only">{t("downloadAria")}</span>
    </Button>
  );
}
