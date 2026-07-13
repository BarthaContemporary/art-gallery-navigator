"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function OfferResponse({
  token,
  initialResponse,
}: {
  token: string;
  initialResponse: "interested" | "declined" | null;
}) {
  const [status, setStatus] = useState<Status>(
    initialResponse === "interested" ? "success" : "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/offer-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          response: "interested",
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-card border border-line-soft bg-cell p-6 text-sm leading-relaxed text-ink-body"
      >
        <p className="font-medium text-ink-strong">Thank you for your interest.</p>
        <p className="mt-1">We will be in touch personally very shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="offer-message" className="block text-sm font-medium text-ink-label">
        A note for us <span className="font-normal text-ink-faint">(optional)</span>
      </label>
      <textarea
        id="offer-message"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Which works caught your eye, or any questions."
        className="w-full rounded-control border border-line-control bg-control px-3 py-2.5 text-sm text-ink-body placeholder:text-ink-faint focus:border-line-control-active"
      />
      {status === "error" ? (
        <p role="alert" className="text-sm text-ink-strong">
          Something went wrong — please try again, or simply reply to our email.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="min-h-11 rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "I’m interested"}
      </button>
    </form>
  );
}
