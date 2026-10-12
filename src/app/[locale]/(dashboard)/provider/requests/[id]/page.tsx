"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestDescription } from "@/components/requests/request-description";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { RequestStats } from "@/components/requests/request-stats";
import { RequestWorkspace } from "@/components/requests/request-workspace";
import { MessagesCard } from "@/components/requests/messages-card";
import { ProviderChatActions } from "@/components/requests/provider-chat-actions";
import { ClientIdentitySheet } from "@/components/requests/client-identity-sheet";
import { trpc } from "@/lib/trpc/client";
import { resolveLocalizedText } from "@/lib/i18n";
import { calculateAttributeCredits } from "@/lib/attribute-validation";
import { getRequestThreadPollingInterval } from "@/lib/request-realtime";
import { useProviderRequestUnread } from "@/hooks/use-provider-request-unread";
import { MessageSquare } from "lucide-react";

export default function ProviderRequestDetailPage() {
  const params = useParams();
  const t = useTranslations("provider.requestDetail");
  const locale = useLocale();
  const requestId = params?.id as string;
  const { markRead } = useProviderRequestUnread();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (requestId) markRead(requestId);
  }, [requestId, markRead]);

  const { data: request, isLoading } = trpc.request.getById.useQuery(
    { id: requestId },
    {
      refetchInterval: (query) =>
        getRequestThreadPollingInterval(
          (query.state.data as { status?: string } | undefined)?.status
        ),
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    const handleThreadUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ notification?: { type?: string }; link?: string }>)
        .detail;
      const notificationType = detail?.notification?.type;
      const link = detail?.link ?? "";
      const isThreadEvent = notificationType === "message" || notificationType === "status_change";
      const isCurrentRequest = link.includes(`/requests/${requestId}`);

      if (!isThreadEvent || !isCurrentRequest) {
        return;
      }

      void utils.request.getById.invalidate({ id: requestId });
    };

    globalThis.addEventListener("wengz:request-thread-updated", handleThreadUpdate);
    return () => globalThis.removeEventListener("wengz:request-thread-updated", handleThreadUpdate);
  }, [requestId, utils.request.getById]);

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
        <Link href="/provider/my-requests">
          <Button className="mt-4">{t("backToMyRequests")}</Button>
        </Link>
      </div>
    );
  }

  const canStart = request.status === "PENDING";
  const canDeliver = request.status === "IN_PROGRESS" || request.status === "REVISION_REQUESTED";
  const isAwaiting = request.status === "DELIVERED";
  const isCompleted = request.status === "COMPLETED";

  const attributeCredits = (() => {
    const existing = (request as any).attributeCredits ?? 0;
    if (existing > 0) return existing;
    try {
      const responses = (request as any).attributeResponses;
      const attrs = (request.serviceType as any).attributes;
      if (attrs && responses) {
        const derived = calculateAttributeCredits(attrs as any, responses as any);
        if (derived > 0) return derived;
      }
    } catch {
      // keep existing
    }
    return existing;
  })();

  const chatActions =
    canStart || canDeliver || isAwaiting || isCompleted ? (
      <ProviderChatActions
        requestId={requestId}
        mode={canStart ? "start" : canDeliver ? "deliver" : isAwaiting ? "awaiting" : "completed"}
        maxDeliveryMinutes={request.serviceType?.maxDeliveryMinutes ?? 480}
        existingRating={
          (request as any).rating
            ? {
                rating: (request as any).rating.rating,
                reviewText: (request as any).rating.reviewText,
              }
            : null
        }
      />
    ) : null;

  const chatPanel = request.providerId ? (
    <MessagesCard
      requestId={requestId}
      comments={request.comments as any}
      title={t("messages.title")}
      description={t("messages.description")}
      placeholder={t("messages.placeholder")}
      canSendMessages={request.status !== "COMPLETED"}
      maskClientNames
      variant="panel"
      threadFooter={chatActions}
    />
  ) : (
    <Card className="border-dashed flex h-[calc(100dvh-14rem)] min-h-[20rem] flex-col justify-center lg:h-[min(75dvh,48rem)]">
      <CardHeader className="text-center px-4">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <CardTitle className="text-lg">{t("messages.title")}</CardTitle>
        <CardDescription className="text-sm">{t("messagingAfterClaim")}</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
      <RequestHeader
        title={request.title}
        status={request.status}
        creditCost={(request as any).creditCost}
        baseCreditCost={(request as any).baseCreditCost}
        attributeCredits={attributeCredits}
        priorityCreditCost={(request as any).priorityCreditCost ?? 0}
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
        backUrl="/provider/my-requests"
        backLabel={t("backToMyRequests")}
        actions={request.clientId ? <ClientIdentitySheet clientId={request.clientId} /> : undefined}
      />

      <RequestWorkspace
        emphasize="chat"
        info={
          <>
            <RequestStats
              createdAt={request.createdAt}
              estimatedDelivery={request.estimatedDelivery}
              deliveredAt={(request as any).deliveredAt}
              completedAt={request.completedAt}
              rating={(request as any).rating}
            />

            <RequestDescription
              description={request.description}
              attachments={request.attachments || []}
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
              serviceTypeName={resolveLocalizedText(
                (request.serviceType as any).nameI18n,
                locale,
                request.serviceType.name
              )}
              serviceTypeIcon={request.serviceType.icon || undefined}
              createdAt={request.createdAt}
              updatedAt={request.updatedAt}
              estimatedDelivery={request.estimatedDelivery}
              completedAt={request.completedAt}
              currentRevisionCount={request.currentRevisionCount}
              totalRevisions={request.totalRevisions}
            />
          </>
        }
        chat={chatPanel}
      />
    </div>
  );
}
