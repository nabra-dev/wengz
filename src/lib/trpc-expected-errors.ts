/**
 * tRPC error codes that represent expected client-facing failures
 * (validation, auth, conflicts, rate limits). These should not become
 * Sentry issues — the API response is the intended UX.
 */
const EXPECTED_TRPC_CLIENT_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

export function isExpectedTrpcClientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // Raw Zod validation failures (sometimes reported before wrapping as TRPCError)
  if ("name" in error && error.name === "ZodError") return true;

  const code = "code" in error ? error.code : undefined;
  return typeof code === "string" && EXPECTED_TRPC_CLIENT_CODES.has(code);
}
