import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Max fraction digits for all system finance/price amounts (display + rounding). */
export const MONEY_MAX_FRACTION_DIGITS = 4;

/**
 * Round a money amount to at most 4 decimal places (e.g. 0.00977 → 0.0098).
 */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Number(amount.toFixed(MONEY_MAX_FRACTION_DIGITS));
}

/**
 * Format a money amount as-is with up to 4 decimals (no forced trailing zeros).
 */
export function formatMoneyAmount(amount: number, locale: string = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: MONEY_MAX_FRACTION_DIGITS,
  }).format(roundMoney(amount));
}

export function formatCurrency(amount: number, locale: string = "en"): string {
  // Always show $ before the number for consistency
  return `$${formatMoneyAmount(amount, locale)}`;
}

export function formatDate(date: Date | string, locale: string = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale: string = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    IN_PROGRESS: "bg-primary/15 text-primary",
    DELIVERED: "bg-[#E0F840]/20 text-[#690DD4] dark:text-[#E0F840]",
    REVISION_REQUESTED: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    COMPLETED: "bg-green-500/15 text-green-600 dark:text-green-400",
    CANCELLED: "bg-destructive/15 text-destructive",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    DELIVERED: "Delivered",
    REVISION_REQUESTED: "Revision Requested",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status.replaceAll("_", " ");
}

export function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    1: "Low",
    2: "Medium",
    3: "High",
  };
  return labels[priority] || "Medium";
}

export function getPriorityColor(priority: number): string {
  const colors: Record<number, string> = {
    1: "bg-gray-100 text-gray-800",
    2: "bg-yellow-100 text-yellow-800",
    3: "bg-red-100 text-red-800",
  };
  return colors[priority] || "bg-gray-100 text-gray-800";
}

export function calculateDaysRemaining(endDate: Date): number {
  const now = Date.now();
  const end = new Date(endDate).getTime();
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function generateRequestNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REQ-${timestamp}-${random}`;
}
