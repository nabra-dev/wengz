"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestDescription } from "@/components/requests/request-description";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { MessagesCard } from "@/components/requests/messages-card";
import { ProviderDeliverables } from "@/components/requests/provider-deliverables";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { resolveLocalizedText } from "@/lib/i18n";
import { getRequestThreadPollingInterval } from "@/lib/request-realtime";
import { CheckCircle, RotateCcw, Star, CreditCard } from "lucide-react";

export default function RequestDetailPage() {
  const t = useTranslations("client.requestDetail");
  const tSidebar = useTranslations("requests.sidebar");
  const locale = useLocale();
  const params = useParams();
  const requestId = params?.id as string;
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const utils = trpc.useUtils();

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

  // Validation constants
  const MIN_REVISION_FEEDBACK = 10;
  const revisionFeedbackValid = revisionFeedback.trim().length >= MIN_REVISION_FEEDBACK;

  const approveRequest = trpc.request.approve.useMutation({
    onSuccess: () => {
      utils.request.getById.invalidate({ id: requestId });
      toast.success(t("toast.approved"), {
        description: t("toast.approvedDesc"),
      });
    },
    onError: (error: unknown) => {
      showError(error, "Failed to approve request");
    },
  });

  const requestRevision = trpc.request.requestRevision.useMutation({
    onSuccess: () => {
      setRevisionFeedback("");
      utils.request.getById.invalidate({ id: requestId });
      void utils.subscription.getActive.invalidate();
      toast.info(t("toast.revisionRequested"), {
        description: t("toast.revisionRequestedDesc"),
      });
    },
    onError: (error: unknown) => {
      showError(error, "Failed to request revision");
    },
  });

  const submitRating = trpc.request.rate.useMutation({
    onSuccess: () => {
      utils.request.getById.invalidate({ id: requestId });
      toast.success(t("toast.ratingSubmitted"), {
        description: t("toast.ratingSubmittedDesc"),
      });
    },
    onError: (error: unknown) => {
      showError(error, "Failed to submit rating");
    },
  });

  const handleApprove = () => {
    approveRequest.mutate({ requestId });
  };

  const handleRequestRevision = () => {
    if (!revisionFeedbackValid) {
      toast.error(t("toast.invalidFeedback"), {
        description: t("toast.invalidFeedbackDesc", { min: MIN_REVISION_FEEDBACK }),
      });
      return;
    }
    requestRevision.mutate({ requestId, feedback: revisionFeedback });
  };

  const handleSubmitRating = () => {
    if (rating === 0) return;
    submitRating.mutate({ requestId, rating, reviewText });
  };

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
  const revisionInfo = request.revisionInfo;

  // Check if user has enough credits for paid revision
  const needsPaidRevision = revisionInfo && revisionInfo.freeRevisionsRemaining === 0;
  const hasEnoughCredits = subscription?.remainingCredits >= (revisionInfo?.nextRevisionCost || 0);
  const canAffordRevision = !needsPaidRevision || hasEnoughCredits;

  return (
    <div className="space-y-6">
      {/* Header */}
      <RequestHeader
        title={request.title}
        status={request.status}
        priority={request.priority}
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
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <RequestDescription description={request.description} attachments={request.attachments} />

          {/* Provider Deliverables */}
          <ProviderDeliverables
            comments={request.comments as any}
            providerName={tSidebar("brandProviderName")}
            providerImage="/images/logo.svg"
          />

          {/* Service-Specific Q&A Responses */}
          {(request as any).attributeResponses &&
            Array.isArray((request as any).attributeResponses) &&
            (request as any).attributeResponses.length > 0 && (
              <AttributeResponsesDisplay
                responses={(request as any).attributeResponses}
                serviceAttributes={(request.serviceType as any).attributes}
              />
            )}

          {/* Actions for DELIVERED status */}
          {canApprove && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">{t("deliverableReady.title")}</CardTitle>
                <CardDescription className="text-blue-700">
                  {t("deliverableReady.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleApprove}
                    disabled={approveRequest.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {approveRequest.isPending
                      ? t("deliverableReady.approving")
                      : t("deliverableReady.approve")}
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-600">{t("requestRevision.title")}</span>
                    {revisionInfo && (
                      <span className="text-sm text-muted-foreground">
                        {revisionInfo.freeRevisionsRemaining > 0 ? (
                          <span className="text-green-600">
                            (
                            {t("requestRevision.freeRemaining", {
                              count: revisionInfo.freeRevisionsRemaining,
                              revision:
                                revisionInfo.freeRevisionsRemaining === 1
                                  ? t("requestRevision.revision")
                                  : t("requestRevision.revisions"),
                            })}
                            )
                          </span>
                        ) : (
                          <span className="text-orange-600">
                            (
                            {t("requestRevision.noFreeLeft", {
                              cost: revisionInfo.nextRevisionCost,
                            })}
                            )
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Textarea
                      placeholder={t("requestRevision.placeholder")}
                      value={revisionFeedback}
                      onChange={(e) => setRevisionFeedback(e.target.value)}
                      className={
                        revisionFeedback.length > 0 && !revisionFeedbackValid
                          ? "border-red-500"
                          : ""
                      }
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span
                        className={
                          revisionFeedback.length > 0 && !revisionFeedbackValid
                            ? "text-red-500"
                            : ""
                        }
                      >
                        {revisionFeedback.length > 0 &&
                          !revisionFeedbackValid &&
                          t("requestRevision.minCharacters", { min: MIN_REVISION_FEEDBACK })}
                      </span>
                      <span
                        className={
                          revisionFeedback.trim().length < MIN_REVISION_FEEDBACK
                            ? "text-red-500"
                            : "text-green-600"
                        }
                      >
                        {revisionFeedback.trim().length}/{MIN_REVISION_FEEDBACK}
                      </span>
                    </div>
                  </div>
                  {needsPaidRevision && !hasEnoughCredits && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="font-medium text-red-800">
                        {t("requestRevision.insufficientCredits")}
                      </p>
                      <p className="text-xs text-red-700 mt-2">
                        {t("requestRevision.insufficientCreditsDesc", {
                          required: revisionInfo?.nextRevisionCost || 0,
                          available: subscription?.remainingCredits || 0,
                        })}
                      </p>
                      <Link href="/client/subscription" className="inline-block mt-3">
                        <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                          <CreditCard className="h-3 w-3" />
                          {t("requestRevision.buyCredits")}
                        </Button>
                      </Link>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleRequestRevision}
                    disabled={
                      !revisionFeedbackValid || requestRevision.isPending || !canAffordRevision
                    }
                  >
                    {requestRevision.isPending
                      ? t("requestRevision.requesting")
                      : t("requestRevision.button")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rating section for COMPLETED status */}
          {canRate && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">{t("rateService.title")}</CardTitle>
                <CardDescription className="text-green-700">
                  {t("rateService.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`p-1 ${star <= rating ? "text-yellow-500" : "text-gray-300"}`}
                    >
                      <Star className="h-8 w-8 fill-current" />
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Textarea
                    placeholder={t("rateService.reviewPlaceholder")}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />
                  {reviewText.length > 0 && (
                    <div className="flex justify-end text-xs text-muted-foreground">
                      <span>{t("rateService.charactersCount", { count: reviewText.length })}</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleSubmitRating}
                  disabled={rating === 0 || submitRating.isPending}
                >
                  {submitRating.isPending ? t("rateService.submitting") : t("rateService.submit")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Existing Rating */}
          {request.rating && (
            <Card>
              <CardHeader>
                <CardTitle>{t("yourRating.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= request.rating!.rating
                          ? "text-yellow-500 fill-current"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                {request.rating.reviewText && (
                  <p className="text-muted-foreground">{request.rating.reviewText}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chat (only after a provider has claimed the job) */}
          {request.provider ? (
            <MessagesCard
              requestId={requestId}
              comments={request.comments as any}
              title={t("messagesTitle")}
              description={t("messagesDescription")}
              placeholder={t("messagesPlaceholder")}
              canSendMessages={request.status !== "COMPLETED"}
              maskProviderNames
            />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>{t("messagesTitle")}</CardTitle>
                <CardDescription>{t("messagingAfterClaim")}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Sidebar */}
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
      </div>
    </div>
  );
}
