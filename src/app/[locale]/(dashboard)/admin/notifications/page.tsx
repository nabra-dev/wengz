"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OffsetPagination } from "@/components/ui/offset-pagination";
import { useListPage } from "@/hooks/use-list-page";
import { trpc } from "@/lib/trpc/client";
import { useRealtimeNotifications } from "@/components/providers/notification-provider";
import { formatDateTime } from "@/lib/utils";
import { Bell, Check } from "lucide-react";

const NOTIFICATIONS_PAGE_SIZE = 20;

export default function AdminNotificationsPage() {
  const t = useTranslations("admin.notificationsPage");
  const locale = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { refreshUnreadCount } = useRealtimeNotifications();
  const { page, offset, pageSize, setPage } = useListPage({
    pageSize: NOTIFICATIONS_PAGE_SIZE,
  });

  const {
    data: notifications,
    isLoading,
    isFetching,
  } = trpc.notification.getAll.useQuery({
    limit: pageSize,
    offset,
  });

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
  const unreadLabel =
    unreadCount === 1
      ? t("unreadCount", { count: unreadCount })
      : t("unreadCountPlural", { count: unreadCount });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            {t("markAllAsRead")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("allNotifications")}</CardTitle>
          <CardDescription>{unreadLabel}</CardDescription>
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
            <div className="space-y-4">
              {notifications?.notifications.map(
                (notification: {
                  id: string;
                  title: string;
                  message: string;
                  link: string | null;
                  isRead: boolean;
                  createdAt: Date;
                }) => (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <div
                    key={notification.id}
                    className={`relative p-4 pe-16 rounded-lg border transition-colors ${
                      notification.isRead ? "bg-background" : "bg-primary/5 border-primary/20"
                    } ${notification.link ? "cursor-pointer hover:bg-muted" : ""}`}
                    onClick={() => {
                      if (notification.link) {
                        if (!notification.isRead) {
                          markAsRead.mutate({ id: notification.id });
                        }
                        router.push(notification.link);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (notification.link && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        if (!notification.isRead) {
                          markAsRead.mutate({ id: notification.id });
                        }
                        router.push(notification.link);
                      }
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{notification.title}</p>
                        {!notification.isRead && (
                          <Badge variant="default" className="text-xs">
                            {t("new")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(notification.createdAt, locale)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 end-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate({ id: notification.id });
                        }}
                        disabled={markAsRead.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              )}
              <OffsetPagination
                page={page}
                pageSize={pageSize}
                total={notifications?.total ?? 0}
                hasMore={notifications?.hasMore}
                onPageChange={setPage}
                isFetching={isFetching}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
