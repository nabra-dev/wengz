"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestCard } from "@/components/requests/request-card";
import { EmptyRequestsState } from "@/components/requests/empty-requests-state";
import { trpc } from "@/lib/trpc/client";
import { useProviderJobsRealtimeRefresh } from "@/hooks/use-provider-jobs-realtime-refresh";
import { useProviderRequestUnread } from "@/hooks/use-provider-request-unread";

export default function MyRequestsPage() {
  const t = useTranslations("provider.myRequests");
  const { data: requestsData, isLoading } = trpc.provider.getMyRequests.useQuery({
    limit: 50,
  });
  const { isUnread } = useProviderRequestUnread();

  const requestIds = useMemo(
    () => requestsData?.requests.map((request: { id: string }) => request.id) ?? [],
    [requestsData?.requests]
  );
  useProviderJobsRealtimeRefresh(requestIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("allMyRequests")}</CardTitle>
          <CardDescription>
            {t("totalRequests", { count: requestsData?.requests.length || 0 })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}
          {!isLoading && requestsData?.requests.length === 0 && (
            <EmptyRequestsState
              title={t("noRequests.title")}
              description={t("noRequests.description")}
              actionLabel={t("noRequests.actionLabel")}
              actionHref="/provider/available"
            />
          )}
          {!isLoading && (requestsData?.requests.length ?? 0) > 0 && (
            <div className="space-y-4">
              {requestsData?.requests.map((request: any) => (
                <RequestCard
                  key={request.id}
                  id={request.id}
                  title={request.title}
                  status={request.status}
                  creditCost={request.creditCost || 0}
                  createdAt={request.createdAt}
                  serviceType={request.serviceType}
                  client={request.client}
                  commentCount={request._count.comments}
                  href={`/provider/requests/${request.id}`}
                  variant="compact"
                  unread={isUnread(request.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
