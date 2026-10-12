"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { showError } from "@/lib/error-handler";
import { CheckCircle, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type ExistingRating = {
  rating: number;
  reviewText: string | null;
};

export type StaffChatActionsProps = {
  readonly requestId: string;
  readonly mode: "approveOnBehalf" | "completed";
  readonly existingRating?: ExistingRating | null;
};

export function StaffChatActions({ requestId, mode, existingRating }: StaffChatActionsProps) {
  const t = useTranslations("admin.requests.detail");
  const tCompleted = useTranslations("provider.requestDetail");
  const utils = trpc.useUtils();

  const approveOnBehalf = trpc.admin.approveRequestOnBehalf.useMutation({
    onSuccess: () => {
      void utils.request.getById.invalidate({ id: requestId });
      void utils.request.getAll.invalidate();
      toast.success(t("toast.approvedOnBehalf"), {
        description: t("toast.approvedOnBehalfDesc"),
      });
    },
    onError: (error: unknown) => {
      showError(error, t("toast.approveOnBehalfError"));
    },
  });

  if (mode === "completed") {
    return (
      <div className="mx-1 mt-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-start shadow-sm sm:mx-2 sm:p-3.5">
        <div className="flex items-start gap-2">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{tCompleted("completed.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tCompleted("completed.description")}
            </p>
            {existingRating ? (
              <div className="mt-3 border-t border-border/40 pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {tCompleted("rating.title")}
                </p>
                <div className="mt-1.5 flex gap-0.5" aria-label={tCompleted("rating.title")}>
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

  return (
    <div className="mx-1 mt-2 rounded-2xl border border-primary/25 bg-primary/10 p-3 text-start shadow-sm sm:mx-2 sm:p-3.5">
      <p className="text-sm font-semibold text-foreground">{t("approveOnBehalf")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("approveOnBehalfHint")}</p>
      <div className="mt-3 flex justify-start">
        <Button
          size="sm"
          className="w-full gap-1.5 sm:w-auto"
          disabled={approveOnBehalf.isPending}
          onClick={() => {
            if (!window.confirm(t("approveOnBehalfConfirm"))) return;
            approveOnBehalf.mutate({ requestId });
          }}
        >
          {approveOnBehalf.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {t("approveOnBehalf")}
        </Button>
      </div>
    </div>
  );
}
