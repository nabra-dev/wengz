"use client";

import { useSession } from "next-auth/react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { trpc } from "@/lib/trpc/client";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Plus, CreditCard, FileText, Clock, CheckCircle } from "lucide-react";

export default function ClientDashboard() {
  const t = useTranslations("client.dashboard");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data: session } = useSession();
  const { data: subscription, isLoading: subLoading } = trpc.subscription.getActive.useQuery();
  const { data: usageStats, isLoading: statsLoading } = trpc.subscription.getUsageStats.useQuery();
  const { data: requestsData, isLoading: requestsLoading } = trpc.request.getAll.useQuery({
    limit: 5,
  });

  const isLoading = subLoading || statsLoading || requestsLoading;
  const hasSubscription = !!subscription;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("welcome", { name: session?.user?.name?.split(" ")[0] || "" })}
        description={t("overview")}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/client/requests/new" className="flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              {t("newRequest")}
            </Link>
          </Button>
        }
      />

      {/* Stats Cards */}
      <div
        className={
          hasSubscription || isLoading
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        <Card
          className={!hasSubscription && !isLoading ? "border-primary/20 bg-primary/5" : undefined}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.creditsAvailable")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {subscription?.remainingCredits || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subscription
                    ? t("stats.plan", {
                        name: resolveLocalizedText(
                          subscription.package?.nameI18n,
                          locale,
                          subscription.package?.name
                        ),
                      })
                    : t("stats.noActivePlan")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.activeRequests")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {usageStats?.activeRequests || 0}
                </div>
                <p className="text-xs text-muted-foreground">{t("stats.inProgressOrPending")}</p>
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
                <div className="text-2xl font-bold tabular-nums">
                  {usageStats?.completedRequests || 0}
                </div>
                <p className="text-xs text-muted-foreground">{t("stats.allTime")}</p>
              </>
            )}
          </CardContent>
        </Card>

        {(hasSubscription || isLoading) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("stats.subscription")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading && <Skeleton className="h-8 w-20" />}
              {!isLoading && subscription && (
                <>
                  <div className="text-2xl font-bold tabular-nums">
                    {subscription.daysRemaining}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("stats.daysRemaining")}</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* No subscription warning */}
      {!isLoading && !subscription && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">{t("noSubscription.title")}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("noSubscription.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/client/subscription">{t("noSubscription.viewPlans")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Requests */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{t("recentRequests.title")}</CardTitle>
            <CardDescription>{t("recentRequests.description")}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto shrink-0">
            <Link href="/client/requests">{t("recentRequests.viewAll")}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {!isLoading && requestsData?.requests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{t("recentRequests.noRequests")}</p>
              <p className="text-sm mb-4">{t("recentRequests.noRequestsDescription")}</p>
              <Button asChild>
                <Link href="/client/requests/new" className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t("newRequest")}
                </Link>
              </Button>
            </div>
          )}
          {!isLoading && (requestsData?.requests.length ?? 0) > 0 && (
            <div className="space-y-3">
              {requestsData?.requests.map((request: any) => {
                const serviceName = resolveLocalizedText(
                  request.serviceType?.nameI18n,
                  locale,
                  request.serviceType?.name
                );

                return (
                  <Link key={request.id} href={`/client/requests/${request.id}`} className="block">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors min-w-0">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium truncate">{request.title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span className="truncate">{serviceName}</span>
                          <span className="hidden sm:inline" aria-hidden>
                            •
                          </span>
                          <span className="shrink-0">{formatDate(request.createdAt, locale)}</span>
                        </div>
                      </div>
                      <Badge
                        variant={null}
                        className={`shrink-0 self-start sm:self-center ${getStatusColor(request.status)}`}
                      >
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
    </div>
  );
}
