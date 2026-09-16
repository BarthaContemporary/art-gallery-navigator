"use client";

import { useState } from "react";

/**
 * Footer newsletter: Name + Email, both required. Translucent white fields
 * on the orange; white button with orange text. Success replaces the form
 * with one line.
 */
export function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          consent: data.get("consent") === "on",
          website: String(data.get("website") ?? ""),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not sign you up");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not sign you up");
    }
  }

  const done = status === "done";

  return (
    <div>
    <div className="fold" data-open={!done} aria-hidden={done} inert={done}>
      <div>
        <div className="fold-body">
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2" noValidate={false}>
      <label className="sr-only" htmlFor="nl-name">
        Name
      </label>
      <input
        id="nl-name"
        name="name"
        required
        autoComplete="name"
        placeholder="Name"
        className="min-h-[40px] w-full bg-white/15 px-3 py-2 font-sans text-[16px] text-white placeholder:text-white/75 md:min-h-[36px] md:text-[13px]"
      />
      <label className="sr-only" htmlFor="nl-email">
        Email address
      </label>
      <input
        id="nl-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Email address"
        className="min-h-[40px] w-full bg-white/15 px-3 py-2 font-sans text-[16px] text-white placeholder:text-white/75 md:min-h-[36px] md:text-[13px]"
      />
      {/* Honeypot — hidden from people, filled by bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 py-1 font-sans text-[11.5px] leading-snug text-white/90">
        <input type="checkbox" name="consent" required className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-white" />
        <span>
          I agree to receive the gallery&rsquo;s newsletter by email and have read the{" "}
          <a href="/privacy" className="underline hover:text-white">
            privacy policy
          </a>
          . Unsubscribe at any time.
        </span>
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-[40px] bg-white px-4 font-sans text-[13px] font-semibold text-accent hover:bg-white/90 disabled:opacity-70 md:min-h-[36px]"
      >
        {status === "sending" ? "Signing up…" : "Sign up"}
      </button>
      {error ? (
        <p className="font-sans text-[13px] text-white" role="alert">
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
          <p className="mt-4 font-sans text-ui" role="status">
            {done ? <>Thank you — you&rsquo;re on the list.</> : null}
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
