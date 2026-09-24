/** Shared timing helpers for request detail stats. */

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Compact human duration, e.g. "45m", "2h 10m", "1d 3h". */
export function formatCompactDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export type DeliveryTimingStatus = "pending" | "on_track" | "overdue" | "on_time" | "late";

export function getDeliveryTimingStatus(params: {
  estimatedDelivery?: Date | string | null;
  deliveredAt?: Date | string | null;
  now?: Date;
}): DeliveryTimingStatus {
  const estimated = toDate(params.estimatedDelivery);
  if (!estimated) return "pending";

  const delivered = toDate(params.deliveredAt);
  if (delivered) {
    return delivered.getTime() <= estimated.getTime() ? "on_time" : "late";
  }

  const now = params.now ?? new Date();
  return now.getTime() <= estimated.getTime() ? "on_track" : "overdue";
}
