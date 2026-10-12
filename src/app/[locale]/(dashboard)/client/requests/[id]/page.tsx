"use client";

import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestDescription } from "@/components/requests/request-description";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { RequestWorkspace } from "@/components/requests/request-workspace";
import { MessagesCard } from "@/components/requests/messages-card";
import { ClientChatActions } from "@/components/requests/client-chat-actions";
import { trpc } from "@/lib/trpc/client";
import { resolveLocalizedText } from "@/lib/i18n";
import { getRequestThreadPollingInterval } from "@/lib/request-realtime";
import { MessageSquare } from "lucide-react";

export default function RequestDetailPage() {
  const t = useTranslations("client.requestDetail");
  const locale = useLocale();
  const params = useParams();
  const requestId = params?.id as string;

  const { data: request, isLoading } = trpc.request.getById.useQuery(
    { id: requestId },
    {
      refetchInterval: (query) =>
        getRequestThreadPollingInterval(
          (query.state.data as { status?: string } | undefined)?.status
        ),
      refetchIntervalInBackground: false,
    }
  );

  const { data: subscription } = trpc.subscription.getActive.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">{t("notFound")}</h2>
        <Link href="/client/requests">
          <Button className="mt-4">{t("backToRequests")}</Button>
        </Link>
      </div>
    );
  }

  const canApprove = request.status === "DELIVERED";
  const canRate = request.status === "COMPLETED" && !request.rating;
  const hasRating = Boolean(request.rating);
  const revisionInfo = request.revisionInfo;

  const chatActions =
    canApprove || canRate || hasRating ? (
      <ClientChatActions
        requestId={requestId}
        mode={canApprove ? "review" : canRate ? "rate" : "rated"}
        revisionInfo={revisionInfo || undefined}
        remainingCredits={subscription?.remainingCredits ?? 0}
        existingRating={
          request.rating
            ? {
                rating: request.rating.rating,
                reviewText: request.rating.reviewText,
              }
            : null
        }
      />
    ) : null;

  return (
    <div className="space-y-6">
      <RequestHeader
        title={request.title}
        status={request.status}
        creditCost={(request as any).creditCost}
        baseCreditCost={(request as any).baseCreditCost}
        attributeCredits={(request as any).attributeCredits}
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
        backUrl="/client/requests"
        needsManualApproval={(request as any).needsManualApproval === true}
      />

      <RequestWorkspace
        emphasize="chat"
        info={
          <>
            <RequestDescription
              description={request.description}
              attachments={request.attachments}
            />

            {(request as any).attributeResponses &&
              Array.isArray((request as any).attributeResponses) &&
              (request as any).attributeResponses.length > 0 && (
                <AttributeResponsesDisplay
                  responses={(request as any).attributeResponses}
                  serviceAttributes={(request.serviceType as any).attributes}
                />
              )}

            <RequestSidebar
              provider={request.provider}
              serviceTypeName={resolveLocalizedText(
                (request.serviceType as any).nameI18n,
                locale,
                request.serviceType.name
              )}
              serviceTypeIcon={request.serviceType.icon || undefined}
              createdAt={request.createdAt}
              estimatedDelivery={request.estimatedDelivery}
              completedAt={request.completedAt}
              currentRevisionCount={request.currentRevisionCount}
              totalRevisions={request.totalRevisions}
              revisionInfo={revisionInfo || undefined}
              maskProviderNameForClient
            />
          </>
        }
        chat={
          request.provider ? (
            <MessagesCard
              requestId={requestId}
              comments={request.comments as any}
              title={t("messagesTitle")}
              description={t("messagesDescription")}
              placeholder={t("messagesPlaceholder")}
              canSendMessages={request.status !== "COMPLETED"}
              maskProviderNames
              variant="panel"
              afterLatestDeliverable={chatActions}
            />
          ) : (
            <Card className="border-dashed flex h-[calc(100dvh-14rem)] min-h-[20rem] flex-col justify-center lg:h-[min(75dvh,48rem)]">
              <CardHeader className="text-center px-4">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                <CardTitle className="text-lg">{t("messagesTitle")}</CardTitle>
                <CardDescription className="text-sm">{t("messagingAfterClaim")}</CardDescription>
              </CardHeader>
            </Card>
          )
        }
      />
    </div>
  );
}
