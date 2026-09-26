/**
 * Whether the Sentry SDK should send events.
 *
 * Production VPS: enabled when a DSN is set.
 * Local machines: disabled even if NODE_ENV=production and a DSN is in `.env`
 * (avoids laptop noise like missing CRON_SECRET during local `next start`).
 *
 * Opt out anywhere with SENTRY_DISABLE=true.
 *
 * Keep this module Edge/client-safe — no `node:` imports.
 */

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function isLocalAppUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isLocalBrowserOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

/** Prefer HOSTNAME/COMPUTERNAME when set (no node:os — Edge-safe). */
function isLocalHostnameFromEnv(): boolean {
  const host = process.env.HOSTNAME || process.env.COMPUTERNAME || "";
  return host === "localhost" || host.endsWith(".local");
}

export function isSentryEnabled(): boolean {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn?.trim()) return false;
  if (process.env.NODE_ENV !== "production") return false;
  if (isTruthy(process.env.SENTRY_DISABLE)) return false;

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl && isLocalAppUrl(appUrl)) return false;

  if (isLocalBrowserOrigin()) return false;
  if (isLocalHostnameFromEnv()) return false;

  return true;
}
