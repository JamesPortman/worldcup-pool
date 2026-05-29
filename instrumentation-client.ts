import * as Sentry from "@sentry/nextjs";

// Client-side error monitoring. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

// Instruments client-side route transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
