"use client";

import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

/** "Sign in with passkey" — usernameless WebAuthn assertion, then redirect in. */
export function PasskeySignIn() {
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(window.PublicKeyCredential));
  }, []);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const optRes = await fetch("/api/passkey/auth/options", { method: "POST" });
      if (!optRes.ok) throw new Error("Could not start passkey sign-in");
      const optionsJSON = await optRes.json();

      const assertion = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/passkey/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        const j = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Passkey sign-in failed");
      }
      window.location.href = "/";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Passkey sign-in failed";
      setErr(/notallowed|cancel|abort|timed/i.test(msg) ? null : msg);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-line-control bg-cell font-semibold text-ink-body disabled:opacity-60"
      >
        {busy ? "Waiting for passkey…" : "🔑 Sign in with passkey"}
      </button>
      {err ? <p className="mt-2 text-center text-[12px] text-oranje">{err}</p> : null}
      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
        <span className="h-px flex-1 bg-line-soft" /> or <span className="h-px flex-1 bg-line-soft" />
      </div>
    </div>
  );
}
