"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { CheckCircle, Clock, Play, Star, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const ESTIMATE_PRESET_MINUTES = [15, 30, 45] as const;

type ExistingRating = {
  rating: number;
  reviewText: string | null;
};

export type ProviderChatActionsProps = {
  readonly requestId: string;
  readonly mode: "start" | "deliver" | "awaiting" | "completed";
  readonly maxDeliveryMinutes?: number;
  readonly existingRating?: ExistingRating | null;
};

export function ProviderChatActions({
  requestId,
  mode,
  maxDeliveryMinutes = 480,
  existingRating,
}: ProviderChatActionsProps) {
  const t = useTranslations("provider.requestDetail");
  const utils = trpc.useUtils();

  const [deliverable, setDeliverable] = useState("");
  const [deliverableFiles, setDeliverableFiles] = useState<UploadedFile[]>([]);
  const [estimatedDeliveryMode, setEstimatedDeliveryMode] = useState<"preset" | "custom">("preset");
  const [estimatedPresetMinutes, setEstimatedPresetMinutes] = useState<string>(
    ESTIMATE_PRESET_MINUTES[1].toString()
  );
  const [customEstimatedMinutes, setCustomEstimatedMinutes] = useState("");

  const minEstimateMinutes = 15;
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
      void utils.request.getById.invalidate({ id: requestId });
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
      setDeliverableFiles([]);
      void utils.request.getById.invalidate({ id: requestId });
      toast.success(t("toast.deliverableSubmitted"), {
        description: t("toast.deliverableSubmittedDesc"),
      });
    },
    onError: (error) => {
      showError(error, t("toast.deliverFailed"));
    },
  });

  const estimatePreview = (() => {
    const minutes = parsedEstimatedMinutes;
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
      return `${minutes} ${minutes === 1 ? t("startWork.minute") : t("startWork.minutesPlural")}`;
    }
    if (minutes < 1440) {
      const hours = Number((minutes / 60).toFixed(1));
      return `${hours} ${hours === 1 ? t("startWork.hour") : t("startWork.hoursPlural")}`;
    }
    const days = Number((minutes / 1440).toFixed(1));
    return `~${days} ${days === 1 ? t("startWork.day") : t("startWork.daysPlural")}`;
  })();

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
  };

  if (mode === "awaiting") {
    return (
      <div className="mx-1 mt-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-start shadow-sm sm:mx-2 sm:p-3.5">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("awaitingReview.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("awaitingReview.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "completed") {
    return (
      <div className="mx-1 mt-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-start shadow-sm sm:mx-2 sm:p-3.5">
        <div className="flex items-start gap-2">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("completed.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("completed.description")}</p>
            {existingRating ? (
              <div className="mt-3 border-t border-border/40 pt-3">
                <p className="text-xs font-medium text-muted-foreground">{t("rating.title")}</p>
                <div className="mt-1.5 flex gap-0.5" aria-label={t("rating.title")}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-4 w-4",
                        star <= existingRating.rating
                          ? "fill-current text-yellow-500"
                          : "text-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
                {existingRating.reviewText ? (
                  <p className="mt-2 text-sm text-foreground/90">{existingRating.reviewText}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "start") {
    return (
      <div className="mx-1 mt-2 rounded-2xl border border-primary/25 bg-primary/10 p-3 text-start shadow-sm sm:mx-2 sm:p-3.5">
        <p className="text-sm font-semibold text-foreground">{t("startWork.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("startWork.description")}</p>

        <div className="mt-3 space-y-2">
          <label htmlFor="provider-chat-estimate" className="text-xs font-medium text-foreground">
            {t("startWork.estimatedDeliveryTime")}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="provider-chat-estimate"
              value={estimatedDeliveryMode === "custom" ? "custom" : estimatedPresetMinutes}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setEstimatedDeliveryMode("custom");
                  return;
                }
                setEstimatedDeliveryMode("preset");
                setEstimatedPresetMinutes(e.target.value);
              }}
              className="flex h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
            >
              {estimatePresets.map((minutes) => (
                <option key={minutes} value={minutes.toString()}>
                  {minutes}
                </option>
              ))}
              <option value="custom">{t("startWork.customOption")}</option>
            </select>
            <span className="text-xs text-muted-foreground">{t("startWork.minutes")}</span>
          </div>

          {estimatedDeliveryMode === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="provider-chat-estimate-custom"
                type="number"
                min={minEstimateMinutes}
                max={maxDeliveryMinutes}
                value={customEstimatedMinutes}
                onChange={(e) => setCustomEstimatedMinutes(e.target.value)}
                aria-invalid={showCustomEstimateValidation}
                className={cn(
                  "flex h-9 w-28 rounded-md border bg-background px-2 text-sm",
                  showCustomEstimateValidation ? "border-destructive" : "border-input"
                )}
                placeholder={t("startWork.customPlaceholder")}
              />
              <span className="text-xs text-muted-foreground">{t("startWork.minutes")}</span>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">{estimatePreview}</p>
          <p className="text-xs text-muted-foreground">
            {t("startWork.estimateRange", {
              min: minEstimateMinutes,
              max: maxDeliveryMinutes,
            })}
          </p>
        </div>

        <div className="mt-3 flex justify-start">
          <Button
            size="sm"
            onClick={handleStartWork}
            disabled={startWork.isPending || !isEstimatedMinutesValid}
            className="w-full gap-1.5 sm:w-auto"
          >
            <Play className="h-4 w-4" />
            {startWork.isPending ? t("startWork.starting") : t("startWork.button")}
          </Button>
        </div>
      </div>
    );
  }

  // mode === "deliver"
  return (
    <div className="mx-1 mt-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-start shadow-sm sm:mx-2 sm:p-3.5">
      <p className="text-sm font-semibold text-foreground">{t("submitDeliverable.title")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("submitDeliverable.description")}</p>

      <Textarea
        placeholder={t("submitDeliverable.placeholder")}
        value={deliverable}
        onChange={(e) => setDeliverable(e.target.value)}
        rows={3}
        className="mt-3 min-h-[4.5rem] bg-background/80 text-sm"
      />

      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-foreground">{t("submitDeliverable.attachFiles")}</p>
        <FileUpload
          onFilesChange={setDeliverableFiles}
          maxFiles={10}
          maxSizeMB={500}
          disabled={deliverWork.isPending}
        />
      </div>

      <div className="mt-3 flex justify-start">
        <Button
          size="sm"
          onClick={handleDeliver}
          disabled={!deliverable.trim() || deliverWork.isPending}
          className="w-full gap-1.5 sm:w-auto"
        >
          <Upload className="h-4 w-4" />
          {deliverWork.isPending
            ? t("submitDeliverable.submitting")
            : t("submitDeliverable.button")}
        </Button>
      </div>
    </div>
  );
}
