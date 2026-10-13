"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { createClient } from "@jvb/db/browser";
import { safeNextPath } from "@/lib/auth-rules";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { KeyIcon } from "@/components/ui/icons";

/**
 * Passkey sign-in for the login page. Two paths, both Apple-friendly:
 *  - the explicit button → Face ID / Touch ID sheet (or "use iPhone/iPad"
 *    via QR when the passkey lives on another device);
 *  - conditional UI: Safari/iOS offers the passkey directly in the email
 *    field's autofill, thanks to autocomplete="username webauthn".
 */
export function PasskeyLogin({ next = null }: { next?: string | null } = {}) {
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
    // Back to the page that asked for sign-in, when it is a path on this site.
    window.location.href = safeNextPath(next) ?? "/";
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
      <Button
        className="w-full"
        icon={<KeyIcon size={16} />}
        onClick={() => void signIn()}
        pending={state === "busy"}
        pendingLabel="Waiting for Face ID or Touch ID…"
      >
        Sign in with passkey
      </Button>
      {error ? (
        <Notice tone="danger" inline className="mt-2 w-full">
          {error}
        </Notice>
      ) : null}
      <div className="label mt-5 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-rule-strong" />
        or with password
        <span aria-hidden className="h-px flex-1 bg-rule-strong" />
      </div>
    </div>
  );
}
