"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { CheckCircle, CreditCard, RotateCcw, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type RevisionInfo = {
  freeRevisionsRemaining: number;
  nextRevisionCost: number;
};

type ExistingRating = {
  rating: number;
  reviewText: string | null;
};

export type ClientChatActionsProps = {
  readonly requestId: string;
  readonly mode: "review" | "rate" | "rated";
  readonly revisionInfo?: RevisionInfo | null;
  readonly remainingCredits?: number;
  readonly existingRating?: ExistingRating | null;
};

export function ClientChatActions({
  requestId,
  mode,
  revisionInfo,
  remainingCredits = 0,
  existingRating,
}: ClientChatActionsProps) {
  const t = useTranslations("client.requestDetail");
  const utils = trpc.useUtils();

  const [showRevision, setShowRevision] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const revisionFeedbackValid = revisionFeedback.trim().length >= 1;
  const needsPaidRevision = Boolean(revisionInfo && revisionInfo.freeRevisionsRemaining === 0);
  const hasEnoughCredits =
    !needsPaidRevision || remainingCredits >= (revisionInfo?.nextRevisionCost || 0);

  const approveRequest = trpc.request.approve.useMutation({
    onSuccess: () => {
      void utils.request.getById.invalidate({ id: requestId });
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
      setShowRevision(false);
      void utils.request.getById.invalidate({ id: requestId });
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
      void utils.request.getById.invalidate({ id: requestId });
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
        description: t("toast.invalidFeedbackDesc", { min: 1 }),
      });
      return;
    }
    requestRevision.mutate({ requestId, feedback: revisionFeedback });
  };

  const handleSubmitRating = () => {
    if (rating === 0) return;
    submitRating.mutate({ requestId, rating, reviewText });
  };

  if (mode === "rated" && existingRating) {
    return (
      <div className="mx-1 mt-2 rounded-2xl border border-border/70 bg-[hsl(var(--card))]/95 p-3 shadow-sm ring-1 ring-white/5 sm:mx-2 sm:p-3.5">
        <p className="text-xs font-medium text-muted-foreground">{t("yourRating.title")}</p>
        <div className="mt-1.5 flex gap-0.5" aria-label={t("yourRating.title")}>
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
    );
  }

  if (mode === "rate") {
    return (
      <div className="mx-1 mt-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 shadow-sm sm:mx-2 sm:p-3.5">
        <p className="text-sm font-semibold text-foreground">{t("rateService.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("rateService.description")}</p>

        <div className="mt-3 flex gap-1" role="group" aria-label={t("rateService.title")}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              aria-label={t("rateService.rateStars", { count: star })}
              aria-pressed={star <= rating}
              className={cn(
                "rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                star <= rating
                  ? "text-yellow-500"
                  : "text-muted-foreground/35 hover:text-muted-foreground"
              )}
            >
              <Star className="h-7 w-7 fill-current" />
            </button>
          ))}
        </div>

        <Textarea
          placeholder={t("rateService.reviewPlaceholder")}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="mt-3 min-h-[4.5rem] bg-background/80 text-sm"
        />

        <Button
          size="sm"
          className="mt-3 w-full sm:w-auto"
          onClick={handleSubmitRating}
          disabled={rating === 0 || submitRating.isPending}
        >
          {submitRating.isPending ? t("rateService.submitting") : t("rateService.submit")}
        </Button>
      </div>
    );
  }

  // mode === "review"
  return (
    <div className="mx-1 mt-2 rounded-2xl border border-primary/25 bg-primary/10 p-3 shadow-sm sm:mx-2 sm:p-3.5">
      <p className="text-sm font-semibold text-foreground">{t("deliverableReady.title")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("deliverableReady.description")}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={approveRequest.isPending || requestRevision.isPending}
          className="w-full gap-1.5 sm:w-auto"
        >
          <CheckCircle className="h-4 w-4" />
          {approveRequest.isPending
            ? t("deliverableReady.approving")
            : t("deliverableReady.approve")}
        </Button>
        <Button
          size="sm"
          variant={showRevision ? "secondary" : "outline"}
          onClick={() => setShowRevision((open) => !open)}
          disabled={approveRequest.isPending || requestRevision.isPending}
          className="w-full gap-1.5 sm:w-auto"
        >
          <RotateCcw className="h-4 w-4" />
          {t("requestRevision.title")}
        </Button>
      </div>

      {showRevision ? (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          {revisionInfo ? (
            <p className="text-xs text-muted-foreground">
              {revisionInfo.freeRevisionsRemaining > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {t("requestRevision.freeRemaining", {
                    count: revisionInfo.freeRevisionsRemaining,
                    revision:
                      revisionInfo.freeRevisionsRemaining === 1
                        ? t("requestRevision.revision")
                        : t("requestRevision.revisions"),
                  })}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  {t("requestRevision.noFreeLeft", {
                    cost: revisionInfo.nextRevisionCost,
                  })}
                </span>
              )}
            </p>
          ) : null}

          <Textarea
            placeholder={t("requestRevision.placeholder")}
            value={revisionFeedback}
            onChange={(e) => setRevisionFeedback(e.target.value)}
            className={cn(
              "min-h-[4.5rem] bg-background/80 text-sm",
              revisionFeedback.length > 0 && !revisionFeedbackValid && "border-destructive"
            )}
          />

          {needsPaidRevision && !hasEnoughCredits ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                {t("requestRevision.insufficientCredits")}
              </p>
              <p className="mt-1 text-xs text-destructive/90">
                {t("requestRevision.insufficientCreditsDesc", {
                  required: revisionInfo?.nextRevisionCost || 0,
                  available: remainingCredits,
                })}
              </p>
              <Link href="/client/subscription" className="mt-2 inline-block">
                <Button size="sm" variant="destructive" className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t("requestRevision.buyCredits")}
                </Button>
              </Link>
            </div>
          ) : null}

          <Button
            size="sm"
            variant="secondary"
            onClick={handleRequestRevision}
            disabled={!revisionFeedbackValid || requestRevision.isPending || !hasEnoughCredits}
            className="w-full gap-1.5 sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            {requestRevision.isPending
              ? t("requestRevision.requesting")
              : t("requestRevision.button")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
