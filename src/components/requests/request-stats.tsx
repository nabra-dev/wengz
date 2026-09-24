"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/utils";
import {
  formatCompactDuration,
  getDeliveryTimingStatus,
  toDate,
} from "@/lib/request-timing";

type RequestStatsProps = {
  readonly createdAt: Date | string;
  readonly estimatedDelivery?: Date | string | null;
  readonly deliveredAt?: Date | string | null;
  readonly completedAt?: Date | string | null;
  readonly rating?: { rating: number; reviewText?: string | null } | null;
};

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

export function RequestStats({
  createdAt,
  estimatedDelivery,
  deliveredAt,
  completedAt,
  rating,
}: RequestStatsProps) {
  const t = useTranslations("requests.stats");
  const locale = useLocale();

  const created = toDate(createdAt) ?? new Date();
  const estimated = toDate(estimatedDelivery);
  const delivered = toDate(deliveredAt);
  const completed = toDate(completedAt);
  const timingStatus = getDeliveryTimingStatus({
    estimatedDelivery: estimated,
    deliveredAt: delivered,
  });

  const createdToDelivered =
    delivered != null ? formatCompactDuration(delivered.getTime() - created.getTime()) : null;
  const createdToCompleted =
    completed != null ? formatCompactDuration(completed.getTime() - created.getTime()) : null;

  let timingBadgeLabel = t("timing.pending");
  let timingBadgeVariant: "secondary" | "default" | "destructive" | "outline" = "secondary";
  if (timingStatus === "on_track") {
    timingBadgeLabel = t("timing.onTrack");
    timingBadgeVariant = "default";
  } else if (timingStatus === "overdue") {
    timingBadgeLabel = t("timing.overdue");
    timingBadgeVariant = "destructive";
  } else if (timingStatus === "on_time") {
    timingBadgeLabel = t("timing.onTime");
    timingBadgeVariant = "default";
  } else if (timingStatus === "late") {
    timingBadgeLabel = t("timing.late");
    timingBadgeVariant = "destructive";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        <Badge variant={timingBadgeVariant}>{timingBadgeLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <StatTile label={t("created")} value={formatDateTime(created, locale)} />
          <StatTile
            label={t("estimated")}
            value={estimated ? formatDateTime(estimated, locale) : t("notSet")}
          />
          <StatTile
            label={t("delivered")}
            value={delivered ? formatDateTime(delivered, locale) : t("notYet")}
            hint={createdToDelivered ? t("took", { duration: createdToDelivered }) : null}
          />
          <StatTile
            label={t("completed")}
            value={completed ? formatDateTime(completed, locale) : t("notYet")}
            hint={createdToCompleted ? t("total", { duration: createdToCompleted }) : null}
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <Star className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("rating")}</p>
            {rating ? (
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Stars value={rating.rating} />
                  <span className="text-sm font-medium tabular-nums">{rating.rating}/5</span>
                </div>
                {rating.reviewText ? (
                  <p className="text-sm text-muted-foreground line-clamp-3">{rating.reviewText}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium">{t("notRated")}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
