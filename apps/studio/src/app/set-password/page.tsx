"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";

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
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
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

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[14px] border border-line bg-cell p-8">
        <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink-strong">
          Set your password
        </h1>
        <p className="mt-1 text-[13px] text-ink-muted">Joost van den Bergh · Studio</p>

        {phase === "loading" ? (
          <p className="mt-6 text-[13px] text-ink-soft">Checking your link…</p>
        ) : phase === "invalid" ? (
          <p className="mt-6 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            This link is invalid or has expired. Ask an administrator to re-send your
            invitation.
          </p>
        ) : phase === "done" ? (
          <p className="mt-6 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            Password set. Redirecting you to sign in…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6">
            {error ? (
              <p className="mb-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
                {error}
              </p>
            ) : null}
            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              New password
              <input
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px]"
              />
            </label>
            <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              Confirm password
              <input
                name="confirm"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px]"
              />
            </label>
            <button
              type="submit"
              disabled={phase === "saving"}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-fg disabled:opacity-60"
            >
              {phase === "saving" ? "Saving…" : "Set password"}
            </button>
            <p className="mt-3 text-[12px] text-ink-soft">Minimum 10 characters.</p>
          </form>
        )}
      </div>
    </main>
  );
}
