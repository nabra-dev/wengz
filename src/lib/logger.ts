/**
 * Structured app logger.
 *
 * - Production: warn/error only (stdout + Sentry). debug/info are no-ops for performance.
 * - Development: all levels to console.
 * - Accepts console-style second args (Error | unknown | meta object).
 * - Expected tRPC client errors (CONFLICT, UNAUTHORIZED, …) are never sent to Sentry.
 */

import { isExpectedTrpcClientError } from "@/lib/trpc-expected-errors";
import { isSentryEnabled } from "@/lib/sentry-enabled";

type LogMeta = Record<string, unknown>;

function normalizeMeta(metaOrErr?: unknown): LogMeta | undefined {
  if (metaOrErr === undefined || metaOrErr === null) return undefined;
  if (metaOrErr instanceof Error) return { error: metaOrErr };
  if (typeof metaOrErr === "object" && !Array.isArray(metaOrErr)) {
    return metaOrErr as LogMeta;
  }
  return { detail: metaOrErr };
}

function emit(level: "debug" | "info" | "warn" | "error", message: string, meta?: LogMeta) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && (level === "debug" || level === "info")) return;

  const payload = meta ? { message, ...meta } : message;

  if (level === "error") {
    console.error(payload);
    void captureSentry(level, message, meta);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    void captureSentry(level, message, meta);
    return;
  }
  if (!isProd) {
    // eslint-disable-next-line no-console -- intentional in development
    console[level](payload);
  }
}

async function captureSentry(
  level: "warn" | "error",
  message: string,
  meta?: LogMeta
): Promise<void> {
  try {
    if (!isSentryEnabled()) return;
    if (isExpectedTrpcClientError(meta?.error)) return;

    const Sentry = await import("@sentry/nextjs");
    if (level === "error") {
      if (meta?.error instanceof Error) {
        Sentry.captureException(meta.error, { extra: { message, ...meta } });
      } else {
        Sentry.captureMessage(message, { level: "error", extra: meta });
      }
    } else {
      Sentry.captureMessage(message, { level: "warning", extra: meta });
    }
  } catch {
    // Sentry may be unavailable during early boot — ignore
  }
}

export const logger = {
  debug: (message: string, metaOrErr?: unknown) => emit("debug", message, normalizeMeta(metaOrErr)),
  info: (message: string, metaOrErr?: unknown) => emit("info", message, normalizeMeta(metaOrErr)),
  warn: (message: string, metaOrErr?: unknown) => emit("warn", message, normalizeMeta(metaOrErr)),
  error: (message: string, metaOrErr?: unknown) => emit("error", message, normalizeMeta(metaOrErr)),
};
