"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded / dynamic attachment URLs */

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload, InlineFileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { AttributeResponsesDisplay } from "@/components/client/attribute-responses-display";
import { RequestHeader } from "@/components/requests/request-header";
import { RequestSidebar } from "@/components/requests/request-sidebar";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { formatDateTime, getInitials } from "@/lib/utils";
import { resolveLocalizedText } from "@/lib/i18n";
import { calculateAttributeCredits } from "@/lib/attribute-validation";
import { getRequestThreadPollingInterval } from "@/lib/request-realtime";
import { Send, Upload, Play, CheckCircle } from "lucide-react";

const ESTIMATE_PRESET_MINUTES = [15, 30, 45] as const;

export default function ProviderRequestDetailPage() {
  const params = useParams();
  const t = useTranslations("provider.requestDetail");
  const tMessages = useTranslations("requests.messages");
  const tSidebar = useTranslations("requests.sidebar");
  const locale = useLocale();
  const requestId = params?.id as string;
  const [comment, setComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<UploadedFile[]>([]);
  const [deliverable, setDeliverable] = useState("");
  const [deliverableFiles, setDeliverableFiles] = useState<UploadedFile[]>([]);
  const [estimatedDeliveryMode, setEstimatedDeliveryMode] = useState<"preset" | "custom">("preset");
  const [estimatedPresetMinutes, setEstimatedPresetMinutes] = useState<string>(
    ESTIMATE_PRESET_MINUTES[1].toString()
  );
  const [customEstimatedMinutes, setCustomEstimatedMinutes] = useState<string>("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const previousLastCommentIdRef = useRef<string | null>(null);

  const utils = trpc.useUtils();

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

  const addComment = trpc.request.addComment.useMutation({
    onSuccess: () => {
      setComment("");
      setCommentFiles([]);
      utils.request.getById.invalidate({ id: requestId });
      toast.success(t("toast.messageSent"), {
        description: t("toast.messageSuccess"),
      });
    },
    onError: (error) => {
      showError(error, t("toast.messageFailed"));
    },
  });

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

  const handleSendComment = () => {
    if (!comment.trim() && commentFiles.length === 0) return;
    addComment.mutate({
      requestId,
      content: comment || tMessages("attachmentFallback"),
      files: commentFiles.map((f) => f.url),
    });
  };

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

  useEffect(() => {
    const lastCommentId = request?.comments?.at(-1)?.id ?? null;
    const hasNewLastComment = lastCommentId !== previousLastCommentIdRef.current;
    if (!hasNewLastComment) return;

    previousLastCommentIdRef.current = lastCommentId;

    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [request?.comments]);

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

  // Recompute attribute credits if missing/zero to ensure consistent breakdown
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
    } catch (e) {

    }
    return existing;
  })();

  const priorityCreditCost = (request as any).priorityCreditCost ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>{t("description")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap">{request.description}</p>

              {/* Request Attachments */}
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

          {/* Service-Specific Q&A Responses */}
          {(request as any).attributeResponses &&
            Array.isArray((request as any).attributeResponses) &&
            (request as any).attributeResponses.length > 0 && (
              <AttributeResponsesDisplay
                responses={(request as any).attributeResponses}
                serviceAttributes={(request.serviceType as any).attributes}
              />
            )}

          {/* Action Card */}
          {canStart && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">{t("startWork.title")}</CardTitle>
                <CardDescription className="text-blue-700">
                  {t("startWork.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="estimatedMinutes" className="text-sm font-medium text-blue-800">
                    {t("startWork.estimatedDeliveryTime")}
                  </label>
                  <div className="flex gap-2 items-center">
                    <select
                      id="estimatedMinutes"
                      value={estimatedDeliveryMode === "custom" ? "custom" : estimatedPresetMinutes}
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          setEstimatedDeliveryMode("custom");
                          return;
                        }
                        setEstimatedDeliveryMode("preset");
                        setEstimatedPresetMinutes(e.target.value);
                      }}
                      className="flex text-black h-10 w-24 rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {estimatePresets.map((minutes) => (
                        <option key={minutes} value={minutes.toString()}>
                          {minutes}
                        </option>
                      ))}
                      <option value="custom">{t("startWork.customOption")}</option>
                    </select>
                    <span className="text-sm text-blue-700">{t("startWork.minutes")}</span>
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
                        className={`flex text-black h-10 w-28 rounded-md border bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                          showCustomEstimateValidation ? "border-red-400" : "border-input"
                        }`}
                        placeholder={t("startWork.customPlaceholder")}
                      />
                      <span className="text-sm text-blue-700">{t("startWork.minutes")}</span>
                    </div>
                  )}
                  <p className="text-xs text-blue-600">
                    {(() => {
                      const selectedMinutes =
                        estimatedDeliveryMode === "custom"
                          ? customEstimatedMinutes
                          : estimatedPresetMinutes;
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
                        return `${hours} ${
                          hours === 1 ? t("startWork.hour") : t("startWork.hoursPlural")
                        }`;
                      }
                      const days = Number((minutes / 1440).toFixed(1));
                      return `~${days} ${days === 1 ? t("startWork.day") : t("startWork.daysPlural")}`;
                    })()}
                  </p>
                  <p className="text-xs text-blue-600">
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
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">{t("submitDeliverable.title")}</CardTitle>
                <CardDescription className="text-green-700">
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
                  {deliverable.length > 0 && deliverable.length < 5 && (
                    <p className="text-sm text-amber-600">
                      {t("submitDeliverable.minCharactersWarning", {
                        remaining: 5 - deliverable.length,
                      })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-800">
                    {t("submitDeliverable.attachFiles")}
                  </p>
                  <FileUpload
                    onFilesChange={setDeliverableFiles}
                    maxFiles={10}
                    maxSizeMB={10}
                    disabled={deliverWork.isPending}
                    className="bg-white/50"
                  />
                </div>
                <Button
                  onClick={handleDeliver}
                  disabled={deliverable.trim().length < 5 || deliverWork.isPending}
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
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800">{t("awaitingReview.title")}</CardTitle>
                <CardDescription className="text-yellow-700">
                  {t("awaitingReview.description")}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {request.status === "COMPLETED" && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-800">{t("completed.title")}</CardTitle>
                </div>
                <CardDescription className="text-green-700">
                  {t("completed.description")}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Chat (only after this request is claimed / assigned) */}
          {request.provider ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("messages.title")}</CardTitle>
                <CardDescription>{t("messages.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {t("messages.noMessages")}
                  </p>
                ) : (
                  <div ref={messagesContainerRef} className="space-y-4 max-h-96 overflow-y-auto">
                    {request.comments.map(
                      (comment: {
                        id: string;
                        content: string;
                        type: string;
                        createdAt: Date;
                        files?: string[];
                        user: { name: string | null; image: string | null };
                      }) => (
                        <div
                          key={comment.id}
                          className={`flex gap-3 ${
                            comment.type === "SYSTEM" ? "bg-muted/50 p-3 rounded-lg" : ""
                          }`}
                        >
                          {comment.type !== "SYSTEM" && (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={comment.user.image || ""} />
                              <AvatarFallback>
                                {getInitials(comment.user.name || "")}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {comment.type === "SYSTEM"
                                  ? t("messages.system")
                                  : (comment.user as any).role === "CLIENT"
                                    ? tSidebar("brandClientName")
                                    : comment.user.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(comment.createdAt, locale)}
                              </span>
                              {comment.type === "DELIVERABLE" && (
                                <Badge variant="secondary">{t("messages.deliverable")}</Badge>
                              )}
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                            {comment.files && comment.files.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {comment.files.map((file: string, i: number) => {
                                  // Helper functions (inline for provider page)
                                  const getExtension = (url: string) => {
                                    try {
                                      const clean = url.split("?")[0];
                                      const parts = clean.split(".");
                                      return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
                                    } catch {
                                      return "";
                                    }
                                  };

                                  const isAudioUrl = (url: string) => {
                                    const ext = getExtension(url);
                                    return ["webm", "mp3", "ogg", "wav", "m4a", "aac"].includes(
                                      ext
                                    );
                                  };

                                  const isImageUrl = (url: string) => {
                                    const ext = getExtension(url);
                                    return ["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(
                                      ext
                                    );
                                  };

                                  const getFileNameFromUrl = (url: string) => {
                                    const clean = url.split("?")[0];
                                    const parts = clean.split("/");
                                    return parts.length > 0 ? parts.pop() || url : url;
                                  };

                                  const prettyFilename = (name: string = "") => {
                                    let result = name;
                                    result = result.replaceAll(/^\d{8,}-/g, "");
                                    if (result.length > 60 && result.includes("-")) {
                                      const parts = result.split("-");
                                      result = parts.slice(1).join("-");
                                    }
                                    return result;
                                  };

                                  const audio = isAudioUrl(file);
                                  const image = isImageUrl(file);
                                  const rawFilename = getFileNameFromUrl(file);
                                  const displayName = prettyFilename(rawFilename);
                                  const audioKey = `${comment.id}-audio-${i}`;
                                  const imageKey = `${comment.id}-image-${i}`;
                                  const fileKey = `${comment.id}-file-${i}`;

                                  if (audio) {
                                    return (
                                      <div key={audioKey} className="space-y-1">
                                        <audio controls src={file} className="w-full">
                                          <track kind="captions" />
                                        </audio>
                                        <div className="text-xs text-muted-foreground">
                                          {tMessages("voiceNote")}
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (image) {
                                    return (
                                      <a
                                        key={imageKey}
                                        href={file}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={file}
                                          alt={displayName}
                                          className="max-h-48 rounded border object-contain"
                                        />
                                        <span className="text-xs text-muted-foreground block mt-1">
                                          {tMessages("image")} • {displayName}
                                        </span>
                                      </a>
                                    );
                                  }

                                  return (
                                    <div key={fileKey} className="space-y-1">
                                      <a
                                        href={file}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline block"
                                      >
                                        {tMessages("file")}
                                      </a>
                                      <span className="text-xs text-muted-foreground block">
                                        {displayName}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                <Separator />

                {request.status !== "COMPLETED" && (
                  <div className="space-y-3">
                    <InlineFileUpload
                      onFilesChange={setCommentFiles}
                      maxFiles={3}
                      disabled={addComment.isPending}
                      files={commentFiles}
                    />
                    <div className="flex gap-2">
                      <Textarea
                        placeholder={t("messages.placeholder")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendComment}
                        disabled={
                          (!comment.trim() && commentFiles.length === 0) || addComment.isPending
                        }
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {request.status === "COMPLETED" && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">{t("messages.requestCompleted")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>{t("messages.title")}</CardTitle>
                <CardDescription>{t("messagingAfterClaim")}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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

          {/* Rating */}
          {(request as any).rating && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-800">{t("rating.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
                      <span
                        key={star}
                        className={`text-2xl ${
                          star <= (request as any).rating.rating
                            ? "text-amber-500"
                            : "text-gray-300"
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-xl font-bold text-amber-800">
                    {(request as any).rating.rating}/5
                  </span>
                </div>
                {(request as any).rating.reviewText && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t("rating.review")}</p>
                    <p className="text-sm text-black whitespace-pre-wrap">
                      {(request as any).rating.reviewText}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("rating.ratedOn", {
                      date: formatDateTime((request as any).rating.createdAt, locale),
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
