/**
 * Shared Sentry drop rules for noise that should never become issues.
 */

import { isExpectedTrpcClientError } from "@/lib/trpc-expected-errors";

/** Next.js App Router manifest races / known framework bugs (often bot 404s). */
export function isNextClientManifestNoise(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  if (/client reference manifest/i.test(message)) return true;
  if (name === "InvariantError" && /_not-found|This is a bug in Next\.js/i.test(message)) {
    return true;
  }
  return false;
}

export function shouldDropSentryException(error: unknown): boolean {
  if (isExpectedTrpcClientError(error)) return true;
  if (isNextClientManifestNoise(error)) return true;
  return false;
}
