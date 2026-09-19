/**
 * Lightweight production env validation.
 * Call once at boot (imported from the tRPC entry / Next instrumentation).
 * Missing secrets fail fast instead of failing mid-request.
 */

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "CRON_SECRET",
] as const;

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production environment variables: ${missing.join(", ")}`
    );
  }
}
