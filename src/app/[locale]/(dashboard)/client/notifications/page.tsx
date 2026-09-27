"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { trpc } from "@/lib/trpc/client";
import { useRealtimeNotifications } from "@/components/providers/notification-provider";
import { formatDateTime } from "@/lib/utils";
import { Bell, Check } from "lucide-react";

export default function NotificationsPage() {
  const t = useTranslations("client.notifications");
  const locale = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { refreshUnreadCount } = useRealtimeNotifications();
  const { data: notifications, isLoading } = trpc.notification.getAll.useQuery();

  const markAsRead = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getAll.invalidate();
      refreshUnreadCount();
    },
  });

  const markAllAsRead = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getAll.invalidate();
      refreshUnreadCount();
    },
  });

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handleIncomingNotification = () => {
      utils.notification.getAll.invalidate();
      refreshUnreadCount();
    };

    globalThis.addEventListener("wengz:notification", handleIncomingNotification);
    return () => globalThis.removeEventListener("wengz:notification", handleIncomingNotification);
  }, [refreshUnreadCount, utils.notification.getAll]);

  const unreadCount =
    notifications?.notifications.filter((n: { isRead: boolean }) => !n.isRead).length || 0;

  const openNotification = (notification: { id: string; link: string | null; isRead: boolean }) => {
    if (!notification.link) return;
    if (!notification.isRead) {
      markAsRead.mutate({ id: notification.id });
    }
    router.push(notification.link);
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="flex w-full sm:w-auto items-center gap-2"
            >
              <Check className="h-4 w-4" />
              {t("markAllAsRead")}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("allNotifications")}</CardTitle>
          <CardDescription>
            {unreadCount === 1
              ? t("unreadCount", { count: unreadCount })
              : t("unreadCountPlural", { count: unreadCount })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {!isLoading && notifications?.notifications.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t("noNotifications")}</p>
              <p className="text-sm">{t("noNotificationsDesc")}</p>
            </div>
          )}
          {!isLoading && (notifications?.notifications.length ?? 0) > 0 && (
            <div className="space-y-3">
              {notifications?.notifications.map(
                (notification: {
                  id: string;
                  title: string;
                  message: string;
                  link: string | null;
                  isRead: boolean;
                  createdAt: Date;
                }) => (
                  <div
                    key={notification.id}
                    className={`relative rounded-lg border transition-colors ${
                      notification.isRead ? "bg-background" : "bg-primary/5 border-primary/20"
                    }`}
                  >
                    {notification.link ? (
                      <button
                        type="button"
                        className="w-full text-start p-4 pe-16 rounded-lg hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => openNotification(notification)}
                      >
                        <NotificationBody
                          notification={notification}
                          locale={locale}
                          newLabel={t("new")}
                        />
                      </button>
                    ) : (
                      <div className="p-4 pe-16">
                        <NotificationBody
                          notification={notification}
                          locale={locale}
                          newLabel={t("new")}
                        />
                      </div>
                    )}
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-3 end-3"
                        onClick={() => markAsRead.mutate({ id: notification.id })}
                        disabled={markAsRead.isPending}
                        aria-label={t("markAllAsRead")}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationBody({
  notification,
  locale,
  newLabel,
}: {
  notification: {
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
  };
  locale: string;
  newLabel: string;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{notification.title}</p>
        {!notification.isRead && (
          <Badge variant="default" className="text-xs shrink-0">
            {newLabel}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground break-words">{notification.message}</p>
      <p className="text-xs text-muted-foreground">
        {formatDateTime(notification.createdAt, locale)}
      </p>
    </div>
  );
}
