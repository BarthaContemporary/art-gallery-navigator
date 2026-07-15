"use client";

import { useState, type FormEvent } from "react";
import { TurnstileWidget, turnstileEnabled } from "./turnstile-widget";

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
  const [turnstileToken, setTurnstileToken] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileEnabled && !turnstileToken) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/offer-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          response: "interested",
          message: message.trim() || undefined,
          turnstileToken: turnstileToken || undefined,
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
        className="border border-hairline bg-washi-2 p-6 font-serif text-body text-ink-70"
      >
        <p className="font-sans text-ui font-medium text-sumi">
          Thank you for your interest.
        </p>
        <p className="mt-1">We will be in touch personally very shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="offer-message" className="label block">
        A note for us (optional)
      </label>
      <textarea
        id="offer-message"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Which works caught your eye, or any questions."
        className="w-full border border-hairline bg-washi px-3 py-2.5 font-serif text-ui text-ink-70 placeholder:text-ink-50 focus:border-sumi"
      />
      <TurnstileWidget onToken={setTurnstileToken} />
      {status === "error" ? (
        <p role="alert" className="font-sans text-ui text-sumi">
          Something went wrong — please try again, or simply reply to our email.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn btn-filled disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "I’m interested"}
      </button>
    </form>
  );
}
