"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { RequestCard } from "@/components/requests/request-card";
import { EmptyRequestsState } from "@/components/requests/empty-requests-state";
import { trpc } from "@/lib/trpc/client";
import { Plus } from "lucide-react";

export default function RequestsPage() {
  const t = useTranslations("client.requests");
  const { data: requestsData, isLoading } = trpc.request.getAll.useQuery({
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/client/requests/new" className="flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              {t("newRequest")}
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">{t("allRequests")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("totalRequests", { count: requestsData?.requests.length || 0 })}
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}
        {!isLoading && requestsData?.requests.length === 0 && (
          <EmptyRequestsState
            title={t("noRequests")}
            description={t("noRequestsDesc")}
            actionLabel={t("createRequest")}
            actionHref="/client/requests/new"
          />
        )}
        {!isLoading && (requestsData?.requests.length ?? 0) > 0 && (
          <div className="space-y-3">
            {requestsData?.requests.map((request: any) => (
              <RequestCard
                key={request.id}
                id={request.id}
                title={request.title}
                status={request.status}
                creditCost={request.creditCost || 0}
                createdAt={request.createdAt}
                serviceType={request.serviceType}
                provider={request.provider}
                commentCount={request._count.comments}
                href={`/client/requests/${request.id}`}
                variant="compact"
                showProviderAsBrand
                needsManualApproval={request.needsManualApproval === true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
