"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "checking" | "error";

/**
 * Password gate for a private offer. On success the server sets a signed
 * access cookie and we reload into the offer. The visitor can instead ask for
 * a temporary sign-in link, emailed to the address the gallery holds for them.
 */
export function OfferGate({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [magic, setMagic] = useState<"idle" | "sending" | "sent">("idle");

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("checking");
    try {
      const res = await fetch("/api/offer/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) throw new Error("bad password");
      window.location.reload();
    } catch {
      setStatus("error");
    }
  }

  async function requestLink() {
    setMagic("sending");
    try {
      await fetch("/api/offer/magic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      /* always report the same outcome — no address enumeration */
    }
    setMagic("sent");
  }

  return (
    <div className="page flex flex-col items-start py-[var(--section)]">
      <p className="label">Private viewing</p>
      <h1 className="mt-3 max-w-[var(--measure)] font-sans text-h1 font-medium tracking-tight text-sumi">
        This selection is password-protected
      </h1>
      <p className="mt-5 max-w-[var(--measure)] font-serif text-body text-ink-70">
        Please enter the password from your invitation to continue.
      </p>

      <form onSubmit={unlock} className="mt-8 w-full max-w-sm space-y-3">
        <label htmlFor="offer-password" className="label block">
          Password
        </label>
        <input
          id="offer-password"
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-hairline bg-washi px-3 py-2.5 font-serif text-ui text-ink-70 focus:border-sumi"
        />
        {status === "error" ? (
          <p role="alert" className="font-sans text-ui text-sumi">
            That password wasn’t recognised. Please check your invitation and try again.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={status === "checking" || password.length === 0}
          className="btn btn-filled disabled:opacity-60"
        >
          {status === "checking" ? "Checking…" : "View the selection"}
        </button>
      </form>

      <div className="mt-10 max-w-[var(--measure)] border-t border-hairline pt-6">
        {magic === "sent" ? (
          <p className="font-serif text-ui text-ink-70">
            If we have an email address on file for you, a temporary sign-in link is on its
            way. It’s valid for 30 minutes.
          </p>
        ) : (
          <>
            <p className="font-serif text-ui text-ink-70">
              Don’t have the password to hand?
            </p>
            <button
              type="button"
              onClick={requestLink}
              disabled={magic === "sending"}
              className="btn mt-3 disabled:opacity-60"
            >
              {magic === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
