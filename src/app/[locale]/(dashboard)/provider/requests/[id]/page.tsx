"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { RequestStats } from "@/components/requests/request-stats";
import { RequestWorkspace } from "@/components/requests/request-workspace";
import { MessagesCard } from "@/components/requests/messages-card";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { resolveLocalizedText } from "@/lib/i18n";
import { calculateAttributeCredits } from "@/lib/attribute-validation";
import { getRequestThreadPollingInterval } from "@/lib/request-realtime";
import { useProviderRequestUnread } from "@/hooks/use-provider-request-unread";
import { Upload, Play, CheckCircle, MessageSquare } from "lucide-react";

const ESTIMATE_PRESET_MINUTES = [15, 30, 45] as const;

export default function ProviderRequestDetailPage() {
  const params = useParams();
  const t = useTranslations("provider.requestDetail");
  const locale = useLocale();
  const requestId = params?.id as string;
  const { markRead } = useProviderRequestUnread();
  const [deliverable, setDeliverable] = useState("");
  const [deliverableFiles, setDeliverableFiles] = useState<UploadedFile[]>([]);
  const [estimatedDeliveryMode, setEstimatedDeliveryMode] = useState<"preset" | "custom">("preset");
  const [estimatedPresetMinutes, setEstimatedPresetMinutes] = useState<string>(
    ESTIMATE_PRESET_MINUTES[1].toString()
  );
  const [customEstimatedMinutes, setCustomEstimatedMinutes] = useState<string>("");

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

  const minEstimateMinutes = 15;
  const maxDeliveryMinutes = request?.serviceType?.maxDeliveryMinutes ?? 480;
  const estimatePresets = ESTIMATE_PRESET_MINUTES.filter(
    (minutes) => minutes <= maxDeliveryMinutes
  );
  const selectedEstimateMinutesInput =
    estimatedDeliveryMode === "custom" ? customEstimatedMinutes : estimatedPresetMinutes;
  const parsedEstimatedMinutes = Number.parseInt(selectedEstimateMinutesInput, 10);
  const isEstimatedMinutesValid =
    !Number.isNaN(parsedEstimatedMinutes) &&
    parsedEstimatedMinutes >= minEstimateMinutes &&
    parsedEstimatedMinutes <= maxDeliveryMinutes;
  const showCustomEstimateValidation =
    estimatedDeliveryMode === "custom" &&
    customEstimatedMinutes.trim().length > 0 &&
    !isEstimatedMinutesValid;

  useEffect(() => {
    if (estimatedDeliveryMode !== "preset") return;
    const presetValue = Number.parseInt(estimatedPresetMinutes, 10);
    if (!Number.isNaN(presetValue) && presetValue <= maxDeliveryMinutes) return;
    const fallback =
      [...ESTIMATE_PRESET_MINUTES].reverse().find((minutes) => minutes <= maxDeliveryMinutes) ?? 15;
    queueMicrotask(() => setEstimatedPresetMinutes(fallback.toString()));
  }, [estimatedDeliveryMode, estimatedPresetMinutes, maxDeliveryMinutes]);

  const startWork = trpc.provider.startWork.useMutation({
    onSuccess: () => {
      utils.request.getById.invalidate({ id: requestId });
      toast.success(t("toast.workStarted"), {
        description: t("toast.workStartedDesc"),
      });
    },
    onError: (error) => {
      showError(error, t("toast.startWorkFailed"));
    },
  });

  const deliverWork = trpc.provider.deliverWork.useMutation({
    onSuccess: () => {
      setDeliverable("");
      utils.request.getById.invalidate({ id: requestId });
      toast.success(t("toast.deliverableSubmitted"), {
        description: t("toast.deliverableSubmittedDesc"),
      });
    },
    onError: (error) => {
      showError(error, t("toast.deliverFailed"));
    },
  });

  const handleStartWork = () => {
    if (!isEstimatedMinutesValid) {
      toast.error(t("startWork.invalidInput"), {
        description: t("startWork.invalidInputDesc", {
          min: minEstimateMinutes,
          max: maxDeliveryMinutes,
        }),
      });
      return;
    }
    startWork.mutate({
      requestId,
      estimatedDeliveryMinutes: parsedEstimatedMinutes,
    });
  };

  const handleDeliver = () => {
    if (!deliverable.trim()) return;
    deliverWork.mutate({
      requestId,
      deliverableMessage: deliverable,
      files: deliverableFiles.map((f) => f.url),
    });
    setDeliverableFiles([]);
  };

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

  const priorityCreditCost = (request as any).priorityCreditCost ?? 0;

  const estimatePreview = (() => {
    const selectedMinutes =
      estimatedDeliveryMode === "custom" ? customEstimatedMinutes : estimatedPresetMinutes;
    const minutes = Number.parseInt(selectedMinutes, 10);
    if (Number.isNaN(minutes) || minutes <= 0) {
      return t("startWork.enterMinutes");
    }
    if (minutes < minEstimateMinutes || minutes > maxDeliveryMinutes) {
      return t("startWork.invalidInputDesc", {
        min: minEstimateMinutes,
        max: maxDeliveryMinutes,
      });
    }
    if (minutes < 60) {
      return `${minutes} ${
        minutes === 1 ? t("startWork.minute") : t("startWork.minutesPlural")
      }`;
    }
    if (minutes < 1440) {
      const hours = Number((minutes / 60).toFixed(1));
      return `${hours} ${hours === 1 ? t("startWork.hour") : t("startWork.hoursPlural")}`;
    }
    const days = Number((minutes / 1440).toFixed(1));
    return `~${days} ${days === 1 ? t("startWork.day") : t("startWork.daysPlural")}`;
  })();

  const chatPanel = request.provider ? (
    <MessagesCard
      requestId={requestId}
      comments={request.comments as any}
      title={t("messages.title")}
      description={t("messages.description")}
      placeholder={t("messages.placeholder")}
      canSendMessages={request.status !== "COMPLETED"}
      maskClientNames
      variant="panel"
    />
  ) : (
    <Card className="border-dashed h-[min(70vh,44rem)] flex flex-col justify-center">
      <CardHeader className="text-center">
        <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <CardTitle>{t("messages.title")}</CardTitle>
        <CardDescription>{t("messagingAfterClaim")}</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
      <RequestHeader
        title={request.title}
        status={request.status}
        priority={request.priority}
        creditCost={(request as any).creditCost}
        baseCreditCost={(request as any).baseCreditCost}
        attributeCredits={attributeCredits}
        priorityCreditCost={priorityCreditCost}
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
      />

      <RequestWorkspace
        info={
          <>
            <RequestStats
              createdAt={request.createdAt}
              estimatedDelivery={request.estimatedDelivery}
              deliveredAt={(request as any).deliveredAt}
              completedAt={request.completedAt}
              rating={(request as any).rating}
            />

            <Card>
              <CardHeader>
                <CardTitle>{t("description")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap">{request.description}</p>
                {request.attachments && request.attachments.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">
                      {t("attachments", { count: request.attachments.length })}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {request.attachments.map((file: string, index: number) => {
                        const fileName = file.split("/").pop() || `Attachment ${index + 1}`;
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
                        return (
                          <a
                            key={file}
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                          >
                            {isImage ? (
                              <div className="aspect-video rounded overflow-hidden bg-muted mb-2 flex items-center justify-center">
                                <img
                                  src={file}
                                  alt={fileName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="aspect-video rounded bg-muted mb-2 flex items-center justify-center text-2xl">
                                📎
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground truncate group-hover:text-foreground">
                              {fileName}
                            </p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(request as any).attributeResponses &&
              Array.isArray((request as any).attributeResponses) &&
              (request as any).attributeResponses.length > 0 && (
                <AttributeResponsesDisplay
                  responses={(request as any).attributeResponses}
                  serviceAttributes={(request.serviceType as any).attributes}
                />
              )}

            {canStart && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30">
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-200">
                    {t("startWork.title")}
                  </CardTitle>
                  <CardDescription className="text-blue-700 dark:text-blue-300">
                    {t("startWork.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="estimatedMinutes"
                      className="text-sm font-medium text-blue-800 dark:text-blue-200"
                    >
                      {t("startWork.estimatedDeliveryTime")}
                    </label>
                    <div className="flex gap-2 items-center">
                      <select
                        id="estimatedMinutes"
                        value={
                          estimatedDeliveryMode === "custom" ? "custom" : estimatedPresetMinutes
                        }
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            setEstimatedDeliveryMode("custom");
                            return;
                          }
                          setEstimatedDeliveryMode("preset");
                          setEstimatedPresetMinutes(e.target.value);
                        }}
                        className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {estimatePresets.map((minutes) => (
                          <option key={minutes} value={minutes.toString()}>
                            {minutes}
                          </option>
                        ))}
                        <option value="custom">{t("startWork.customOption")}</option>
                      </select>
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {t("startWork.minutes")}
                      </span>
                    </div>
                    {estimatedDeliveryMode === "custom" && (
                      <div className="flex gap-2 items-center">
                        <input
                          id="customEstimatedMinutes"
                          type="number"
                          min={minEstimateMinutes}
                          max={maxDeliveryMinutes}
                          value={customEstimatedMinutes}
                          onChange={(e) => setCustomEstimatedMinutes(e.target.value)}
                          aria-invalid={showCustomEstimateValidation}
                          className={`flex h-10 w-28 rounded-md border bg-background px-3 py-2 text-sm ${
                            showCustomEstimateValidation ? "border-destructive" : "border-input"
                          }`}
                          placeholder={t("startWork.customPlaceholder")}
                        />
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          {t("startWork.minutes")}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-blue-600 dark:text-blue-400">{estimatePreview}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {t("startWork.estimateRange", {
                        min: minEstimateMinutes,
                        max: maxDeliveryMinutes,
                      })}
                    </p>
                  </div>
                  <Button
                    onClick={handleStartWork}
                    disabled={startWork.isPending || !isEstimatedMinutesValid}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {startWork.isPending ? t("startWork.starting") : t("startWork.button")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {canDeliver && (
              <Card className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30">
                <CardHeader>
                  <CardTitle className="text-green-800 dark:text-green-200">
                    {t("submitDeliverable.title")}
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {t("submitDeliverable.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      placeholder={t("submitDeliverable.placeholder")}
                      value={deliverable}
                      onChange={(e) => setDeliverable(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      {t("submitDeliverable.attachFiles")}
                    </p>
                    <FileUpload
                      onFilesChange={setDeliverableFiles}
                      maxFiles={10}
                      maxSizeMB={500}
                      disabled={deliverWork.isPending}
                    />
                  </div>
                  <Button
                    onClick={handleDeliver}
                    disabled={!deliverable.trim() || deliverWork.isPending}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {deliverWork.isPending
                      ? t("submitDeliverable.submitting")
                      : t("submitDeliverable.button")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {request.status === "DELIVERED" && (
              <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/30">
                <CardHeader>
                  <CardTitle className="text-yellow-800 dark:text-yellow-200">
                    {t("awaitingReview.title")}
                  </CardTitle>
                  <CardDescription className="text-yellow-700 dark:text-yellow-300">
                    {t("awaitingReview.description")}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {request.status === "COMPLETED" && (
              <Card className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-green-800 dark:text-green-200">
                      {t("completed.title")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {t("completed.description")}
                  </CardDescription>
                </CardHeader>
              </Card>
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
