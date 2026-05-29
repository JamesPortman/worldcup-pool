"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Catches uncaught errors in the root layout/render tree and reports them to
// Sentry (a no-op until a DSN is configured), then shows a minimal fallback.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ marginTop: "0.5rem", color: "#666" }}>
          An unexpected error occurred. Please refresh and try again.
        </p>
      </body>
    </html>
  );
}
