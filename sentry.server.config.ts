import * as Sentry from "@sentry/nextjs";
import { isExpectedTrpcClientError } from "./src/lib/trpc-expected-errors";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
  beforeSend(event, hint) {
    if (isExpectedTrpcClientError(hint.originalException)) {
      return null;
    }
    return event;
  },
});
