"use client";

import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, MessageSquare, CheckCircle } from "lucide-react";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestDescription } from "@/components/requests/request-description";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { RequestStats } from "@/components/requests/request-stats";
import { RequestWorkspace } from "@/components/requests/request-workspace";
import { MessagesCard } from "@/components/requests/messages-card";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { resolveLocalizedText } from "@/lib/i18n";
import { calculateAttributeCredits } from "@/lib/attribute-validation";

export default function AdminRequestDetailPage() {
  const t = useTranslations("admin.requests");
  const locale = useLocale();
  const params = useParams();
  const requestId = params?.id as string;
  const utils = trpc.useUtils();

  const { data: request, isLoading } = trpc.request.getById.useQuery({ id: requestId });

  const approveOnBehalf = trpc.admin.approveRequestOnBehalf.useMutation({
    onSuccess: () => {
      void utils.request.getById.invalidate({ id: requestId });
      void utils.request.getAll.invalidate();
      toast.success(t("detail.toast.approvedOnBehalf"), {
        description: t("detail.toast.approvedOnBehalfDesc"),
      });
    },
    onError: (error: unknown) => {
      showError(error, t("detail.toast.approveOnBehalfError"));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">{t("detail.notFound")}</h3>
        <p className="text-muted-foreground mb-4">{t("detail.notFoundDesc")}</p>
        <Link href="/admin/requests">
          <Button className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("detail.backToRequests")}
          </Button>
        </Link>
      </div>
    );
  }

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

  const chatPanel = request.provider ? (
    <MessagesCard
      requestId={requestId}
      comments={request.comments as any}
      title={t("detail.messagesTitle")}
      description={t("detail.messagesDesc")}
      placeholder={t("detail.messagesPlaceholder")}
      canSendMessages={request.status !== "COMPLETED"}
      variant="panel"
    />
  ) : (
    <Card className="border-dashed flex h-[calc(100dvh-14rem)] min-h-[20rem] flex-col justify-center lg:h-[min(75dvh,48rem)]">
      <CardHeader className="text-center px-4">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <CardTitle className="text-lg">{t("detail.messagesTitle")}</CardTitle>
        <CardDescription className="text-sm">{t("detail.messagingAfterClaim")}</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
      <RequestHeader
        title={request.title}
        status={request.status}
        creditCost={(request as any).creditCost}
        baseCreditCost={request.baseCreditCost}
        attributeCredits={attributeCredits}
        priorityCreditCost={request.priorityCreditCost ?? 0}
        isRevision={request.isRevision}
        revisionType={request.revisionType}
        paidRevisionCost={(request.serviceType as any).paidRevisionCost}
        serviceTypeName={resolveLocalizedText(
          (request.serviceType as any).nameI18n,
          locale,
          request.serviceType.name
        )}
        serviceTypeIcon={request.serviceType.icon || undefined}
        createdAt={request.createdAt}
        backUrl="/admin/requests"
        backLabel={t("title")}
        needsManualApproval={(request as any).needsManualApproval === true}
        actions={
          request.status === "DELIVERED" ? (
            <Button
              onClick={() => {
                if (!window.confirm(t("detail.approveOnBehalfConfirm"))) return;
                approveOnBehalf.mutate({ requestId });
              }}
              disabled={approveOnBehalf.isPending}
              className="gap-2"
              title={t("detail.approveOnBehalfHint")}
            >
              {approveOnBehalf.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {t("detail.approveOnBehalf")}
            </Button>
          ) : undefined
        }
      />

      <RequestWorkspace
        info={
          <>
            <RequestStats
              createdAt={request.createdAt}
              estimatedDelivery={request.estimatedDelivery}
              deliveredAt={(request as any).deliveredAt}
              completedAt={request.completedAt}
              rating={request.rating}
            />
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
              client={request.client}
              provider={request.provider || null}
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
