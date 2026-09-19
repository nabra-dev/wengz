"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, X } from "lucide-react";
import { useRealtimeNotifications } from "@/components/providers/notification-provider";
import { isMobileDevice, supportsDesktopNotifications } from "@/lib/device-detection";

export function NotificationPermissionBanner() {
  const { hasPermission, requestPermission, isConnected } = useRealtimeNotifications();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (globalThis.window === undefined) return false;
    return localStorage.getItem("notificationBannerDismissed") === "true";
  });
  const isMobile = useMemo(() => isMobileDevice(), []);
  const supportsNotifications = useMemo(() => supportsDesktopNotifications(), []);

  const showBanner =
    !isDismissed && !hasPermission && isConnected && supportsNotifications && !isMobile;

  const handleRequest = async () => {
    await requestPermission();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("notificationBannerDismissed", "true");
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-600">Enable Desktop Notifications</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Get instant notifications for new messages and status updates, even when you&apos;re on
          another tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button onClick={handleRequest} size="sm" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Enable Notifications
        </Button>
      </CardContent>
    </Card>
  );
}
