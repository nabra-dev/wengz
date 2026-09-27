"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Volume2, X } from "lucide-react";
import { useRealtimeNotifications } from "@/components/providers/notification-provider";
import { isIosDevice, isMobileDevice, isStandalonePwa } from "@/lib/device-detection";

const DISMISS_KEY = "notificationBannerDismissed";

export function NotificationPermissionBanner() {
  const t = useTranslations("dashboard.alerts");
  const {
    hasPermission,
    requestPermission,
    isConnected,
    soundUnlocked,
    unlockSound,
    supportsSystemNotifications,
  } = useRealtimeNotifications();

  const [isDismissed, setIsDismissed] = useState(() => {
    if (globalThis.window === undefined) return false;
    return localStorage.getItem(DISMISS_KEY) === "true";
  });

  const isMobile = useMemo(() => isMobileDevice(), []);
  const isIos = useMemo(() => isIosDevice(), []);
  const isPwa = useMemo(() => isStandalonePwa(), []);

  const needsSystemPermission = supportsSystemNotifications && !hasPermission;
  const needsSoundUnlock = !soundUnlocked;
  const showBanner = !isDismissed && isConnected && (needsSystemPermission || needsSoundUnlock);

  const description = (() => {
    if (isIos && !isPwa) return t("enableIosPwaDescription");
    if (isMobile && !supportsSystemNotifications) return t("enableMobileDescription");
    if (isMobile) return t("enableMobileDescription");
    return t("enableDescription");
  })();

  const handleEnable = async () => {
    if (needsSystemPermission) {
      const granted = await requestPermission();
      const soundOk = await unlockSound();
      if (granted || soundOk) {
        toast.success(t("enabledToast"));
      }
      return;
    }

    const ok = await unlockSound();
    if (ok) toast.success(t("enabledToast"));
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Card className="mb-6 border-border bg-muted/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {needsSystemPermission ? (
              <Bell className="h-5 w-5 shrink-0 text-primary" />
            ) : (
              <Volume2 className="h-5 w-5 shrink-0 text-primary" />
            )}
            <CardTitle className="text-base sm:text-lg">{t("enableTitle")}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          onClick={handleEnable}
          size="sm"
          className="flex w-full sm:w-auto items-center gap-2"
        >
          {needsSystemPermission ? <Bell className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {needsSystemPermission ? t("enableButton") : t("enableSoundButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
