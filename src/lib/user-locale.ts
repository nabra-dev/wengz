import { db } from "@/lib/db";
import { normalizeAppLocale } from "@/lib/notifications/i18n-helper";
import { logger } from "@/lib/logger";

/** Persist the UI locale from the current request when it differs (best-effort). */
export function syncUserPreferredLocale(userId: string, locale: string): void {
  const preferredLocale = normalizeAppLocale(locale);
  void db.user
    .updateMany({
      where: {
        id: userId,
        NOT: { preferredLocale },
      },
      data: { preferredLocale },
    })
    .catch((error) => {
      logger.error(`Failed to sync preferredLocale for ${userId}:`, error);
    });
}

/** Preferred UI locale for one user (defaults to `en`). */
export async function getPreferredLocaleForUser(userId: string): Promise<"en" | "ar"> {
  if (!userId) return "en";
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  });
  return normalizeAppLocale(row?.preferredLocale);
}

/** Batch-load preferred locales for cron / bulk notifications. */
export async function getPreferredLocalesByUserIds(
  userIds: string[]
): Promise<Map<string, "en" | "ar">> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, "en" | "ar">();
  if (uniqueIds.length === 0) return map;

  const rows = await db.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, preferredLocale: true },
  });

  for (const row of rows) {
    map.set(row.id, normalizeAppLocale(row.preferredLocale));
  }
  return map;
}
