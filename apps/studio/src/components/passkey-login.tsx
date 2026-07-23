"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { createClient } from "@jvb/db/browser";

/**
 * Passkey sign-in for the login page. Two paths, both Apple-friendly:
 *  - the explicit button → Face ID / Touch ID sheet (or "use iPhone/iPad"
 *    via QR when the passkey lives on another device);
 *  - conditional UI: Safari/iOS offers the passkey directly in the email
 *    field's autofill, thanks to autocomplete="username webauthn".
 */
export function PasskeyLogin() {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const conditionalStarted = useRef(false);

  async function completeLogin(assertion: unknown) {
    const res = await fetch("/api/passkeys/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: assertion }),
    });
    const json = (await res.json()) as { ok?: boolean; token_hash?: string; error?: string };
    if (!res.ok || !json.token_hash) throw new Error(json.error ?? "Sign-in failed");
    const supabase = createClient();
    const { error: otpErr } = await supabase.auth.verifyOtp({
      token_hash: json.token_hash,
      type: "magiclink",
    });
    if (otpErr) throw new Error(otpErr.message);
    window.location.href = "/";
  }

  async function getOptions() {
    const res = await fetch("/api/passkeys/login-options", { method: "POST" });
    if (!res.ok) throw new Error("Could not start passkey sign-in");
    return res.json();
  }

  async function signIn() {
    if (state === "busy") return;
    setState("busy");
    setError(null);
    try {
      const optionsJSON = await getOptions();
      const assertion = await startAuthentication({ optionsJSON });
      await completeLogin(assertion);
    } catch (e) {
      // NotAllowedError = user dismissed the sheet — not worth an error box.
      const name = (e as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Passkey sign-in failed");
        setState("error");
        return;
      }
      setState("idle");
    }
  }

  // Conditional UI: lets Safari/iOS surface the passkey in the email field's
  // autofill without any click. Runs once; silently unsupported elsewhere.
  useEffect(() => {
    if (conditionalStarted.current) return;
    conditionalStarted.current = true;
    (async () => {
      try {
        if (!(await window.PublicKeyCredential?.isConditionalMediationAvailable?.())) return;
        const optionsJSON = await getOptions();
        const assertion = await startAuthentication({ optionsJSON, useBrowserAutofill: true });
        await completeLogin(assertion);
      } catch {
        /* dismissed / unsupported — the button and password form still work */
      }
    })();
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={state === "busy"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-control bg-control px-4 py-2.5 text-[13px] font-semibold text-ink-body disabled:opacity-60"
      >
        <span aria-hidden>🔑</span>
        {state === "busy" ? "Waiting for Face ID / Touch ID…" : "Sign in with passkey"}
      </button>
      {error ? <p className="mt-2 text-[12px] text-oranje">{error}</p> : null}
      <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        or with password
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
