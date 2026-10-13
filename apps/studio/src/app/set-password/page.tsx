"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";
import { PASSWORD_MIN } from "@/lib/auth-rules";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

type Phase = "loading" | "ready" | "invalid" | "saving" | "done";

export default function SetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  // The recovery link lands here with the session in the URL fragment
  // (#access_token=…&refresh_token=…&type=recovery). Establish the session.
  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const p = new URLSearchParams(hash);
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");

    async function boot() {
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          setPhase("invalid");
          return;
        }
        // Clear the tokens from the address bar.
        window.history.replaceState(null, "", window.location.pathname);
        setPhase("ready");
        return;
      }
      // Maybe already have a session (e.g. re-render) — allow if so.
      const { data } = await supabase.auth.getSession();
      setPhase(data.session ? "ready" : "invalid");
    }
    void boot();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    const confirm = String(new FormData(form).get("confirm") ?? "");
    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setPhase("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setPhase("ready");
      return;
    }
    await supabase.auth.signOut();
    setPhase("done");
    setTimeout(() => router.push("/login"), 1500);
  }

  // Native inputs in the .field look under Field (ids passed to both), so
  // the ui:guard baseline of this form stays as it was.
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="panel w-full max-w-sm p-6 sm:p-8">
        <p className="text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent">Joost van den Bergh</p>
        <h1 className="mt-4 text-title text-ink">Set your password</h1>
        <p className="mt-1 text-[13px] text-meta">Studio</p>

        {phase === "loading" ? (
          <p role="status" className="mt-6 text-[13px] text-meta">
            Checking your link…
          </p>
        ) : phase === "invalid" ? (
          <Notice tone="danger" className="mt-6">
            This link is invalid or has expired. Ask an administrator to send your invitation again.
          </Notice>
        ) : phase === "done" ? (
          <Notice tone="ok" className="mt-6">
            Password set. Taking you to sign in…
          </Notice>
        ) : (
          <form onSubmit={onSubmit} className="mt-6">
            {error ? (
              <Notice tone="danger" className="mb-4">
                {error}
              </Notice>
            ) : null}
            <div className="space-y-4">
              <Field id="set-password-new" label="New password" hint={`At least ${PASSWORD_MIN} characters.`}>
                <input
                  id="set-password-new"
                  name="password"
                  type="password"
                  required
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  aria-describedby="set-password-new-hint"
                  className="field"
                />
              </Field>
              <Field id="set-password-confirm" label="Confirm password">
                <input
                  id="set-password-confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  className="field"
                />
              </Field>
            </div>
            <Button
              type="submit"
              variant="primary"
              className="mt-6 w-full"
              pending={phase === "saving"}
              pendingLabel="Saving…"
            >
              Set password
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
