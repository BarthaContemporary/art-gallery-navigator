"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { CopyIcon, RefreshIcon } from "@/components/ui/icons";

/**
 * What a studio error boundary shows (W16): a plain sentence first, then Try
 * again, Copy details and the way home, with the technical details folded
 * away underneath. The raw message used to lead the page; staff need to know
 * what to do, and whoever fixes it needs the details, which Copy details
 * hands over in one go (page, time, message, digest, stack).
 *
 * Used by app/(app)/error.tsx (inside the shell) and app/global-error.tsx
 * (when the shell itself failed).
 */
export function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // Also in the console, with the full stack, for the browser's devtools.
    console.error("Studio error:", error);
  }, [error]);

  const message = error?.message || String(error) || "(no message)";
  const stack = error?.stack ? error.stack.split("\n").slice(0, 12).join("\n") : null;

  function details(): string {
    return [
      `Page: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `Message: ${message}`,
      error?.digest ? `Digest: ${error.digest}` : null,
      `Browser: ${navigator.userAgent}`,
      stack ? `\n${stack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details());
      setCopy("copied");
      setTimeout(() => setCopy("idle"), 2000);
    } catch {
      // No clipboard (an insecure origin, a denied permission): open the
      // details so they can be selected by hand.
      setCopy("failed");
      if (detailsRef.current) detailsRef.current.open = true;
    }
  }

  return (
    <div className="max-w-[var(--jvb-measure)]">
      <PageHeader title="Something went wrong" />
      <Notice tone="danger">
        This page hit an error and could not be shown. Try again. If it keeps happening, copy the
        details and send them to whoever looks after the studio.
      </Notice>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<RefreshIcon size={16} />} onClick={reset}>
          Try again
        </Button>
        <Button icon={<CopyIcon size={16} />} onClick={() => void copyDetails()}>
          {copy === "copied" ? "Copied" : "Copy details"}
        </Button>
        {/* A plain <a>: after an error a full load is the surest way out. */}
        <ButtonLink href="/" native variant="quiet">
          Go to the dashboard
        </ButtonLink>
      </div>
      {copy === "failed" ? (
        <p role="status" className="mt-2 text-[12px] leading-[1.4] text-meta">
          Copying is blocked here. Select the details below instead.
        </p>
      ) : null}

      <details ref={detailsRef} className="mt-6 border-t border-rule-strong pt-3">
        <summary className="cursor-pointer text-[13px] font-medium text-ink">Technical details</summary>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="label">Message</dt>
            <dd className="mt-1 break-words text-[12.5px] text-body">{message}</dd>
          </div>
          {error?.digest ? (
            <div>
              <dt className="label">Digest</dt>
              <dd className="tabular mt-1 text-[12.5px] text-body">{error.digest}</dd>
            </div>
          ) : null}
          {stack ? (
            <div>
              <dt className="label">Stack</dt>
              <dd>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-band p-3 text-[11.5px] leading-[1.5] text-body">
                  {stack}
                </pre>
              </dd>
            </div>
          ) : null}
        </dl>
      </details>
    </div>
  );
}
