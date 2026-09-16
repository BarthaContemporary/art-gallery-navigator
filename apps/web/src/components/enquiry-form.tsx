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
  withAddress = false,
}: {
  kind: "work" | "publication" | "appointment";
  subject: string;
  pieceId?: string | null;
  defaultMessage: string;
  /** Optional heading line; the inline toggles now carry the label themselves. */
  heading?: string;
  /** Rendered as "↑" next to the heading when both are provided. */
  onCollapse?: () => void;
  columns?: 2 | 3;
  /** Collect a postal address (orders that will be posted). */
  withAddress?: boolean;
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
          address: withAddress
            ? {
                line1: String(data.get("address1") ?? ""),
                line2: String(data.get("address2") ?? "") || undefined,
                city: String(data.get("city") ?? ""),
                postcode: String(data.get("postcode") ?? ""),
                country: String(data.get("country") ?? ""),
              }
            : undefined,
          mailingList: data.get("mailingList") === "on",
          consent: data.get("consent") === "on",
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

  const gridCols = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const done = status === "done";

  // On success the form folds closed while the thank-you line folds open,
  // on the same curves as every drawer, instead of the box snapping.
  return (
    <div>
    <div className="fold" data-open={!done} aria-hidden={done} inert={done}>
      <div>
        <div className="fold-body">
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {heading ? (
      <p className="flex items-baseline gap-2 font-sans text-[12.5px] font-semibold text-ink">
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
      ) : null}
      <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
        <label className="sr-only" htmlFor={`${kind}-name`}>Name</label>
        <input id={`${kind}-name`} name="name" required autoComplete="name" placeholder="Name" className="field field-sm" />
        <label className="sr-only" htmlFor={`${kind}-email`}>Email</label>
        <input id={`${kind}-email`} name="email" type="email" required autoComplete="email" placeholder="Email" className="field field-sm" />
        <label className="sr-only" htmlFor={`${kind}-phone`}>Phone (optional)</label>
        <input id={`${kind}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="Phone (optional)" className="field field-sm" />
        <label className="sr-only" htmlFor={`${kind}-message`}>Message</label>
        <textarea
          id={`${kind}-message`}
          name="message"
          required
          rows={3}
          defaultValue={defaultMessage}
          className="field field-sm sm:col-span-full"
        />
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </div>
      {withAddress ? (
        <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
          <p className="label sm:col-span-full">Postal address</p>
          <label className="sr-only" htmlFor={`${kind}-address1`}>Address</label>
          <input id={`${kind}-address1`} name="address1" required autoComplete="address-line1" placeholder="Address" className="field field-sm sm:col-span-full" />
          <label className="sr-only" htmlFor={`${kind}-address2`}>Address line 2 (optional)</label>
          <input id={`${kind}-address2`} name="address2" autoComplete="address-line2" placeholder="Address line 2 (optional)" className="field field-sm sm:col-span-full" />
          <label className="sr-only" htmlFor={`${kind}-city`}>City</label>
          <input id={`${kind}-city`} name="city" required autoComplete="address-level2" placeholder="City" className="field field-sm" />
          <label className="sr-only" htmlFor={`${kind}-postcode`}>Postcode</label>
          <input id={`${kind}-postcode`} name="postcode" required autoComplete="postal-code" placeholder="Postcode" className="field field-sm" />
          <label className="sr-only" htmlFor={`${kind}-country`}>Country</label>
          <input id={`${kind}-country`} name="country" required autoComplete="country-name" placeholder="Country" className="field field-sm sm:col-span-full" />
        </div>
      ) : null}
      <label className="flex min-h-[44px] items-start gap-2 py-1 font-sans text-small leading-snug text-meta">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" />
        <span>
          I agree to be contacted about this enquiry and accept the{" "}
          <a href="/privacy" className="underline hover:text-ink">
            privacy policy
          </a>{" "}
          and{" "}
          <a href="/terms" className="underline hover:text-ink">
            terms
          </a>
          .
        </span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-[44px] items-center gap-2 font-sans text-small text-meta">
          <input type="checkbox" name="mailingList" className="h-4 w-4 accent-[var(--ink)]" />
          Add me to the mailing list
        </label>
        <button type="submit" className="btn btn-dark min-h-[38px] px-5 text-small" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      <TurnstileWidget onToken={setTurnstileToken} />
      {error ? (
        <p className="font-sans text-small text-accent-deep" role="alert">
          {error}
        </p>
      ) : null}
    </form>
        </div>
      </div>
    </div>
    <div className="fold" data-open={done} aria-hidden={!done}>
      <div>
        <div className="fold-body">
          <p className="font-sans text-ui text-ink" role="status">
            {done ? <>Thank you — your message has been sent. We&rsquo;ll reply by email.</> : null}
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
