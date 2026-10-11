"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OffsetPagination } from "@/components/ui/offset-pagination";
import { useListPage } from "@/hooks/use-list-page";
import { RequestCard } from "@/components/requests/request-card";
import { EmptyRequestsState } from "@/components/requests/empty-requests-state";
import { trpc } from "@/lib/trpc/client";
import { useProviderJobsRealtimeRefresh } from "@/hooks/use-provider-jobs-realtime-refresh";
import { useProviderRequestUnread } from "@/hooks/use-provider-request-unread";
import { ArrowRight } from "lucide-react";

const PAGE_SIZE = 20;

export default function AvailableJobsPage() {
  const t = useTranslations("provider.available");
  const { page, offset, pageSize, setPage } = useListPage({ pageSize: PAGE_SIZE });
  const {
    data: requestsData,
    isLoading,
    isFetching,
  } = trpc.provider.getAvailableRequests.useQuery({
    limit: pageSize,
    offset,
  });
  const { isUnread } = useProviderRequestUnread();

  const requestIds = useMemo(
    () => requestsData?.requests.map((request: { id: string }) => request.id) ?? [],
    [requestsData?.requests]
  );
  useProviderJobsRealtimeRefresh(requestIds);

  const total = requestsData?.total ?? 0;
  const countLabel = t("jobsAvailable", { count: total });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("openRequests")}</CardTitle>
          <CardDescription>{countLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}
          {!isLoading && requestsData?.requests.length === 0 && (
            <EmptyRequestsState title={t("noJobsTitle")} description={t("noJobsDescription")} />
          )}
          {!isLoading && (requestsData?.requests.length ?? 0) > 0 && (
            <div className="space-y-4">
              {requestsData?.requests.map((request: any) => (
                <RequestCard
                  key={request.id}
                  id={request.id}
                  title={request.title}
                  description={request.description}
                  status={request.status}
                  creditCost={request.creditCost || 0}
                  createdAt={request.createdAt}
                  serviceType={request.serviceType}
                  href={`/provider/available/${request.id}`}
                  variant="detailed"
                  unread={isUnread(request.id)}
                  actions={
                    <Link href={`/provider/available/${request.id}`}>
                      <Button size="sm" className="flex items-center gap-2">
                        {t("viewDetails")}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  }
                />
              ))}
              <OffsetPagination
                page={page}
                pageSize={pageSize}
                total={total}
                hasMore={requestsData?.hasMore}
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
