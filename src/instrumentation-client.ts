import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry-enabled";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: isSentryEnabled(),
  tracesSampleRate: 0.1,
  integrations: [
    // Forward console.warn / console.error (from our logger) into Sentry Logs
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
});

/** Instrument App Router navigations for Sentry performance. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
