import { TRPCError } from "@trpc/server";
import { logActivityAsync } from "@/lib/activity-log";
import { rateLimit } from "@/lib/rate-limit";
import { getTranslation } from "@/lib/notifications/i18n-helper";
import { createNotification } from "@/lib/notifications";
import { db } from "@/lib/db";
import {
  CONTACT_LEAK_ERROR_MESSAGE,
  CONTACT_LEAK_RATE_LIMIT,
  CONTACT_LEAK_RATE_LIMIT_MESSAGE,
  findContactLeaks,
  findContactLeaksInFields,
  summarizeContactLeakHits,
  type ContactLeakHit,
  type ContactLeakMode,
  type ContactLeakScanInput,
} from "@/lib/contact-leak";

export type ContactLeakEnforceContext = {
  locale: string;
  actorId?: string | null;
  actorRole?: string | null;
  /** Request id when known (messages / revision / deliver). */
  entityId?: string | null;
  /** Which surface triggered the check (for activity metadata). */
  field?: string | null;
  ip?: string | null;
};

async function getLocalizedMessage(
  locale: string,
  key: string,
  fallback: string,
  values?: Record<string, string | number>
): Promise<string> {
  const message = await getTranslation(locale, key, values);
  return message === key ? fallback : message;
}

export async function getContactLeakErrorMessage(locale: string): Promise<string> {
  return getLocalizedMessage(locale, "errors.contactNotAllowed", CONTACT_LEAK_ERROR_MESSAGE);
}

export async function getContactLeakRateLimitMessage(locale: string): Promise<string> {
  return getLocalizedMessage(
    locale,
    "errors.contactLeakRateLimited",
    CONTACT_LEAK_RATE_LIMIT_MESSAGE
  );
}

async function notifyAdminsContactLeakRepeat(params: { kinds: string[]; locale: string }) {
  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "PROJECT_MANAGER"] }, deletedAt: null },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const title = await getLocalizedMessage(
    params.locale,
    "notifications.contactLeakRepeat.title",
    "Repeated off-platform contact attempts"
  );
  const message = await getLocalizedMessage(
    params.locale,
    "notifications.contactLeakRepeat.message",
    `A user repeatedly tried to share off-platform contact details (${params.kinds.join(", ") || "contact"}).`,
    { kinds: params.kinds.join(", ") || "contact" }
  );

  const link = `/admin/contact-leaks`;

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "general",
        link,
        sendEmail: false,
        locale: params.locale,
        sseI18n: {
          titleKey: "notifications.contactLeakRepeat.title",
          messageKey: "notifications.contactLeakRepeat.message",
          messageParams: { kinds: params.kinds.join(", ") || "contact" },
        },
      })
    )
  );
}

async function handleContactLeakHits(
  hits: ContactLeakHit[],
  ctx: ContactLeakEnforceContext
): Promise<never> {
  const summary = summarizeContactLeakHits(hits);
  const actorId = ctx.actorId ?? null;

  logActivityAsync({
    action: "security.contact_leak",
    level: "warn",
    message: `Blocked off-platform contact attempt (${summary.kinds.join(", ") || "unknown"})`,
    actorId,
    actorRole: ctx.actorRole ?? null,
    entityType: ctx.entityId ? "Request" : null,
    entityId: ctx.entityId ?? null,
    ip: ctx.ip ?? null,
    metadata: {
      ...summary,
      field: ctx.field ?? null,
    },
  });

  if (actorId) {
    const rl = rateLimit(`contact-leak:${actorId}`, CONTACT_LEAK_RATE_LIMIT);
    if (!rl.success) {
      logActivityAsync({
        action: "security.contact_leak_rate_limited",
        level: "error",
        message: "User temporarily locked for repeated contact-leak attempts",
        actorId,
        actorRole: ctx.actorRole ?? null,
        entityType: ctx.entityId ? "Request" : null,
        entityId: ctx.entityId ?? null,
        ip: ctx.ip ?? null,
        metadata: {
          ...summary,
          field: ctx.field ?? null,
          retryAfterSeconds: rl.retryAfterSeconds,
        },
      });

      void notifyAdminsContactLeakRepeat({
        kinds: summary.kinds,
        locale: ctx.locale,
      });

      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: await getContactLeakRateLimitMessage(ctx.locale),
      });
    }
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: await getContactLeakErrorMessage(ctx.locale),
  });
}

/**
 * Block a single free-text field when it contains off-platform contact.
 * Logs each block; after repeated blocks, rate-limits the actor and alerts admins.
 */
export async function enforceNoContactLeak(
  text: string | undefined | null,
  mode: ContactLeakMode,
  ctx: ContactLeakEnforceContext
): Promise<void> {
  if (!text) return;
  const hits = findContactLeaks(text, mode);
  if (hits.length === 0) return;
  await handleContactLeakHits(hits, ctx);
}

/**
 * Block request create payloads (title/description/Q&A) with contact leaks.
 */
export async function enforceNoContactLeakInFields(
  input: ContactLeakScanInput,
  ctx: ContactLeakEnforceContext
): Promise<void> {
  const hits = findContactLeaksInFields(input);
  if (hits.length === 0) return;
  await handleContactLeakHits(hits, { ...ctx, field: ctx.field ?? "request_fields" });
}
