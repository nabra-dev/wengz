"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { formatDate, getStatusColor } from "@/lib/utils";
import { useProviderJobsRealtimeRefresh } from "@/hooks/use-provider-jobs-realtime-refresh";
import { useProviderRequestUnread } from "@/hooks/use-provider-request-unread";
import { FileText, CheckCircle, Star, TrendingUp } from "lucide-react";

export default function ProviderDashboard() {
  const { data: session } = useSession();
  const t = useTranslations("provider.dashboard");
  const tCommon = useTranslations("common");
  const tCard = useTranslations("requests.card");
  const locale = useLocale();
  const { isUnread } = useProviderRequestUnread();

  const { data: myRequests, isLoading: myReqLoading } = trpc.provider.getMyRequests.useQuery({
    limit: 5,
  });
  const { data: availableRequests, isLoading: availableLoading } =
    trpc.provider.getAvailableRequests.useQuery({ limit: 5 });
  const { data: stats, isLoading: statsLoading } = trpc.provider.getStats.useQuery();

  const trackedIds = useMemo(() => {
    const available = availableRequests?.requests.map((r: { id: string }) => r.id) ?? [];
    const mine = myRequests?.requests.map((r: { id: string }) => r.id) ?? [];
    return [...available, ...mine];
  }, [availableRequests?.requests, myRequests?.requests]);
  useProviderJobsRealtimeRefresh(trackedIds);

  const isLoading = myReqLoading || availableLoading || statsLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {t("welcome", { name: session?.user?.name?.split(" ")[0] || "Guest" })}
        </h1>
        <p className="text-muted-foreground">{t("overview")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.activeJobs")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.activeRequests || 0}</div>
                <p className="text-xs text-muted-foreground">{t("stats.inProgress")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.completed")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.completedRequests || 0}</div>
                <p className="text-xs text-muted-foreground">{t("stats.allTime")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.averageRating")}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{(stats?.averageRating ?? 0).toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  {t("stats.reviews", { count: stats?.totalRatings || 0 })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.availableJobs")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{availableRequests?.requests.length || 0}</div>
                <p className="text-xs text-muted-foreground">{t("stats.waitingForProvider")}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("myActiveJobs.title")}</CardTitle>
              <CardDescription>{t("myActiveJobs.description")}</CardDescription>
            </div>
            <Link href="/provider/my-requests">
              <Button variant="outline" size="sm">
                {t("myActiveJobs.viewAll")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            {!isLoading && myRequests?.requests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>{t("myActiveJobs.noActiveJobs")}</p>
              </div>
            )}
            {!isLoading && (myRequests?.requests.length ?? 0) > 0 && (
              <div className="space-y-4">
                {myRequests?.requests.map((request: any) => {
                  const serviceName = resolveLocalizedText(
                    request.serviceType?.nameI18n,
                    locale,
                    request.serviceType?.name
                  );
                  const unread = isUnread(request.id);
                  return (
                    <Link
                      key={request.id}
                      href={`/provider/requests/${request.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 space-y-1">
                          {unread && (
                            <span
                              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                              title={tCard("unread")}
                            >
                              <span className="sr-only">{tCard("unread")}</span>
                            </span>
                          )}
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium truncate">{request.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {serviceName} • {formatDate(request.createdAt, locale)}
                            </p>
                          </div>
                        </div>
                        <Badge variant={null} className={getStatusColor(request.status)}>
                          {tCommon(`requestStatus.${request.status}` as any)}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("availableJobs.title")}</CardTitle>
              <CardDescription>{t("availableJobs.description")}</CardDescription>
            </div>
            <Link href="/provider/available">
              <Button variant="outline" size="sm">
                {t("availableJobs.viewAll")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            {!isLoading && availableRequests?.requests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>{t("availableJobs.noAvailableJobs")}</p>
              </div>
            )}
            {!isLoading && (availableRequests?.requests.length ?? 0) > 0 && (
              <div className="space-y-4">
                {availableRequests?.requests.map((request: any) => {
                  const serviceName = resolveLocalizedText(
                    request.serviceType?.nameI18n,
                    locale,
                    request.serviceType?.name
                  );
                  const unread = isUnread(request.id);
                  return (
                    <Link
                      key={request.id}
                      href={`/provider/available/${request.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 space-y-1">
                          {unread && (
                            <span
                              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                              title={tCard("unread")}
                            >
                              <span className="sr-only">{tCard("unread")}</span>
                            </span>
                          )}
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium truncate">{request.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {serviceName} • {formatDate(request.createdAt, locale)}
                            </p>
                          </div>
                        </div>
                        {unread ? (
                          <Badge variant="secondary">{t("availableJobs.new")}</Badge>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
