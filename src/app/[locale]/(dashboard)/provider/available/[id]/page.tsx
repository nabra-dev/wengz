"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestDescription } from "@/components/requests/request-description";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { trpc } from "@/lib/trpc/client";
import { resolveLocalizedText } from "@/lib/i18n";
import { useProviderRequestUnread } from "@/hooks/use-provider-request-unread";

export default function AvailableJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("provider.availableDetail");
  const locale = useLocale();
  const requestId = params?.id as string;
  const { markRead } = useProviderRequestUnread();

  useEffect(() => {
    if (requestId) markRead(requestId);
  }, [requestId, markRead]);

  const { data: request, isLoading } = trpc.request.getById.useQuery({
    id: requestId,
  });

  const claimRequest = trpc.provider.claimRequest.useMutation({
    onSuccess: () => {
      router.push(`/provider/requests/${requestId}`);
    },
  });

  const handleClaim = () => {
    if (confirm(t("confirmClaim"))) {
      claimRequest.mutate({ requestId });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">{t("notFound")}</h2>
        <Link href="/provider/available">
          <Button className="mt-4">{t("backToAvailable")}</Button>
        </Link>
      </div>
    );
  }

  // If already assigned, redirect
  if (request.provider) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">{t("alreadyClaimed.title")}</h2>
        <Link href="/provider/available">
          <Button className="mt-4">{t("alreadyClaimed.browseJobs")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <RequestHeader
        title={request.title}
        status={request.status}
        priority={request.priority}
        creditCost={(request as any).creditCost}
        baseCreditCost={(request as any).baseCreditCost}
        priorityCreditCost={(request as any).priorityCreditCost}
        isRevision={(request as any).isRevision}
        revisionType={(request as any).revisionType}
        paidRevisionCost={(request.serviceType as any).paidRevisionCost}
        serviceTypeName={resolveLocalizedText(
          (request.serviceType as any).nameI18n,
          locale,
          request.serviceType.name
        )}
        serviceTypeIcon={request.serviceType.icon || undefined}
        createdAt={request.createdAt}
        backUrl="/provider/available"
        actions={
          <Button size="lg" onClick={handleClaim} disabled={claimRequest.isPending}>
            {claimRequest.isPending ? t("claiming") : t("claimJob")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <RequestDescription description={request.description} attachments={request.attachments} />

          {/* Service-Specific Q&A Responses */}
          {(request as any).attributeResponses &&
            Array.isArray((request as any).attributeResponses) &&
            (request as any).attributeResponses.length > 0 && (
              <AttributeResponsesDisplay
                responses={(request as any).attributeResponses}
                serviceAttributes={(request.serviceType as any).attributes}
              />
            )}
        </div>

        {/* Sidebar */}
        <RequestSidebar
          serviceTypeName={resolveLocalizedText(
            (request.serviceType as any).nameI18n,
            locale,
            request.serviceType.name
          )}
          serviceTypeIcon={request.serviceType.icon || undefined}
          createdAt={request.createdAt}
        />
      </div>
    </div>
  );
}
