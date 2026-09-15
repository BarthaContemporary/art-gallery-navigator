"use client";

import { useState } from "react";
import { TurnstileWidget, turnstileEnabled } from "./turnstile-widget";

/**
 * Inline enquiry (handoff 2b3 / 2f / 2g): Name, Email, Phone (optional),
 * Message (prefilled), mailing-list opt-in, near-black Send. Fields are light
 * grey blocks with no borders. Success replaces the form with one line.
 * Never a pop-up — the parent decides where it folds out.
 */
export function EnquiryForm({
  kind,
  subject,
  pieceId,
  defaultMessage,
  heading,
  onCollapse,
  columns = 2,
}: {
  kind: "work" | "publication" | "appointment";
  subject: string;
  pieceId?: string | null;
  defaultMessage: string;
  heading: string;
  /** Rendered as "↑" next to the heading when provided. */
  onCollapse?: () => void;
  columns?: 2 | 3;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (turnstileEnabled && !turnstileToken) {
      setError("Please wait a moment for the verification to complete, then try again.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          subject,
          pieceId: pieceId ?? undefined,
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? "") || undefined,
          message: String(data.get("message") ?? ""),
          mailingList: data.get("mailingList") === "on",
          turnstileToken: turnstileToken || undefined,
          website: String(data.get("website") ?? ""),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not send your enquiry");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not send your enquiry");
    }
  }

  if (status === "done") {
    return (
      <p className="font-sans text-ui text-ink" role="status">
        Thank you — your message has been sent. We&rsquo;ll reply by email.
      </p>
    );
  }

  const gridCols = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2 font-sans text-[13px] font-semibold text-ink">
        {heading}
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse the enquiry form"
            className="font-normal text-light hover:text-ink"
          >
            ↑
          </button>
        ) : null}
      </p>
      <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
        <label className="sr-only" htmlFor={`${kind}-name`}>Name</label>
        <input id={`${kind}-name`} name="name" required autoComplete="name" placeholder="Name" className="field" />
        <label className="sr-only" htmlFor={`${kind}-email`}>Email</label>
        <input id={`${kind}-email`} name="email" type="email" required autoComplete="email" placeholder="Email" className="field" />
        <label className="sr-only" htmlFor={`${kind}-phone`}>Phone (optional)</label>
        <input id={`${kind}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="Phone (optional)" className="field" />
        <label className="sr-only" htmlFor={`${kind}-message`}>Message</label>
        <textarea
          id={`${kind}-message`}
          name="message"
          required
          rows={3}
          defaultValue={defaultMessage}
          className="field sm:col-span-full"
        />
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-[44px] items-center gap-2 font-sans text-meta text-meta">
          <input type="checkbox" name="mailingList" className="h-4 w-4 accent-[var(--ink)]" />
          Add me to the mailing list
        </label>
        <button type="submit" className="btn btn-dark" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      <TurnstileWidget onToken={setTurnstileToken} />
      {error ? (
        <p className="font-sans text-meta text-accent-deep" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
