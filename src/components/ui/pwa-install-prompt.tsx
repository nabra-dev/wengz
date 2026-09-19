"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, Share, MoreVertical } from "lucide-react";
import { Button } from "./button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detect iOS devices
const isIOS = () => {
  if (globalThis.window === undefined) return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS;
};

// Check if app is already installed
const isInstalled = () => {
  if (globalThis.window === undefined) return false;
  return (
    globalThis.matchMedia("(display-mode: standalone)").matches ||
    (globalThis.navigator as any).standalone === true
  );
};

export function PWAInstallPrompt() {
  const t = useTranslations("pwa.install");
  const locale = useLocale();
  const fontClass = locale === "ar" ? "font-cairo" : "font-lato";
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Only run in browser environment
    if (globalThis.window === undefined) return;

    // Don't show if already installed
    if (isInstalled()) return;

    // For iOS devices, show instructions instead of install prompt
    if (isIOS()) {
      setTimeout(() => {
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (!dismissed) {
          setShowIOSInstructions(true);
        }
      }, 3000);
      return;
    }

    // For Android/Desktop Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay
      setTimeout(() => {
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }, 3000);
    };

    globalThis.addEventListener("beforeinstallprompt", handler);

    return () => globalThis.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {

    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setShowPrompt(false);
    setShowIOSInstructions(false);
  };

  // iOS Installation Instructions
  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-4 start-4 end-4 z-50 md:start-auto md:end-4 md:w-96">
        <div className={`rounded-lg border bg-white p-4 shadow-lg dark:bg-gray-900 ${fontClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-black dark:text-white">{t("ios.title")}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("ios.intro")}</p>
              <ol className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
                <li>
                  {t("ios.step1")} <Share className="inline h-3 w-3 mx-1" />
                  <MoreVertical className="inline h-3 w-3 mx-1" />
                </li>
                <li>{t("ios.step2")}</li>
                <li>{t("ios.step3")}</li>
              </ol>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <Button onClick={handleDismiss} variant="outline" className="w-full">
              {t("ios.gotIt")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop Installation Prompt
  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 start-4 end-4 z-50 md:start-auto md:end-4 md:w-96">
      <div className={`rounded-lg border bg-white p-4 shadow-lg dark:bg-gray-900 ${fontClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-black dark:text-white">{t("title")}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("description")}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleInstall} className="flex-1">
            {t("installButton")}
          </Button>
          <Button onClick={handleDismiss} variant="outline" className="flex-1">
            {t("dismissButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
