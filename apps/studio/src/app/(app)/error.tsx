"use client";

import { useEffect } from "react";

/**
 * Segment error boundary for the authenticated app. Surfaces the real error
 * (message / digest / first stack frames) instead of the opaque global
 * "a client-side exception has occurred" screen, so failures are diagnosable
 * in production.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Also log to the console for good measure.
    console.error("App segment error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[720px] py-10">
      <h1 className="text-[20px] font-semibold text-ink-strong">Something went wrong</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        The page hit an error. The details below help us fix it — please share them if
        you’re reporting this.
      </p>

      <div className="mt-5 space-y-3">
        <div className="rounded-lg border border-line bg-band px-3 py-2">
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">Message</p>
          <p className="mt-1 break-words font-mono text-[12.5px] text-ink-body">
            {error?.message || String(error) || "(no message)"}
          </p>
        </div>
        {error?.digest ? (
          <div className="rounded-lg border border-line bg-band px-3 py-2">
            <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">Digest</p>
            <p className="mt-1 font-mono text-[12.5px] text-ink-body">{error.digest}</p>
          </div>
        ) : null}
        {error?.stack ? (
          <div className="rounded-lg border border-line bg-band px-3 py-2">
            <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">Stack</p>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-ink-soft">
              {error.stack.split("\n").slice(0, 12).join("\n")}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-fg"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-lg border border-line-control bg-control px-4 py-2 text-[12.5px] font-medium text-ink-mid"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
