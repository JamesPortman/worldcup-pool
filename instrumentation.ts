import * as Sentry from "@sentry/nextjs";

// Server/edge error monitoring. No-op until SENTRY_DSN is set, so this is safe
// to ship un-configured — add the DSN env var later to turn it on.
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}

// Captures errors thrown in server components / route handlers.
export const onRequestError = Sentry.captureRequestError;
