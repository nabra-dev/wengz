import { isSentryEnabled } from "@/lib/sentry-enabled";
import { shouldDropSentryException } from "@/lib/sentry-filters";

type SentryClient = typeof import("@sentry/nextjs");

let sentryPromise: Promise<SentryClient> | null = null;

function loadSentry(): Promise<SentryClient> | null {
  if (!isSentryEnabled()) return null;
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then((Sentry) => {
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
      Sentry.init({
        dsn,
        enabled: true,
        tracesSampleRate: 0.1,
        integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
        beforeSend(event, hint) {
          if (shouldDropSentryException(hint.originalException)) {
            return null;
          }
          return event;
        },
        ignoreErrors: [/client reference manifest/i, /play\(\) request was interrupted/i],
      });
      return Sentry;
    });
  }
  return sentryPromise;
}

function scheduleSentry() {
  const start = () => {
    void loadSentry();
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 4000 });
    return;
  }
  window.addEventListener("load", start, { once: true });
}

if (typeof window !== "undefined") {
  scheduleSentry();
}

/** Instrument App Router navigations once the SDK has loaded. */
export function onRouterTransitionStart(
  ...args: Parameters<SentryClient["captureRouterTransitionStart"]>
) {
  const pending = loadSentry();
  if (!pending) return;
  void pending.then((Sentry) => {
    Sentry.captureRouterTransitionStart(...args);
  });
}
