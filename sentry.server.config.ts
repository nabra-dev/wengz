import { hostname } from "node:os";
import * as Sentry from "@sentry/nextjs";
import { shouldDropSentryException } from "./src/lib/sentry-filters";
import { isSentryEnabled } from "./src/lib/sentry-enabled";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

function isLocalDevMachine(): boolean {
  try {
    const host = hostname();
    return host === "localhost" || host.endsWith(".local");
  } catch {
    return false;
  }
}

Sentry.init({
  dsn,
  // node:os hostname check stays in this Node-only file (not edge/client).
  enabled: isSentryEnabled() && !isLocalDevMachine(),
  tracesSampleRate: 0.1,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
  beforeSend(event, hint) {
    if (shouldDropSentryException(hint.originalException)) {
      return null;
    }
    return event;
  },
});
