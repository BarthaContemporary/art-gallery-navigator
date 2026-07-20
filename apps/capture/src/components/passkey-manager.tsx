"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { IconKey, IconChevron } from "@/components/icons";

type Passkey = { id: string; device_label: string | null; created_at: string; last_used_at: string | null };

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

/** Enrol this device as a passkey, and list / remove existing ones. */
export function PasskeyManager() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(window.PublicKeyCredential));
  }, []);

  async function load() {
    const res = await fetch("/api/passkey/list");
    if (res.ok) {
      const { passkeys } = (await res.json()) as { passkeys: Passkey[] };
      setKeys(passkeys);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (open && !loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function enrol() {
    setBusy(true);
    setMsg(null);
    try {
      const optRes = await fetch("/api/passkey/register/options", { method: "POST" });
      if (!optRes.ok) throw new Error("Could not start enrolment");
      const optionsJSON = await optRes.json();

      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation, label: deviceLabel() }),
      });
      if (!verifyRes.ok) {
        const j = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Enrolment failed");
      }
      setMsg("Passkey added — you can now sign in with Face ID.");
      await load();
    } catch (e) {
      const m = e instanceof Error ? e.message : "Enrolment failed";
      if (!/notallowed|cancel|abort/i.test(m)) setMsg(m);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/passkey/${encodeURIComponent(id)}`, { method: "DELETE" });
    setKeys((k) => k.filter((x) => x.id !== id));
  }

  if (!supported) return null;

  return (
    <div className="mt-8 rounded-2xl border border-line bg-cell">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-strong">
          <IconKey className="h-[18px] w-[18px]" /> Passkeys
        </span>
        <IconChevron className={`h-4 w-4 text-ink-soft transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-line-soft px-5 py-4">
          <p className="text-[12.5px] text-ink-muted">
            Add this device so you can sign in with Face ID / Touch ID instead of your password.
          </p>

          {loaded && keys.length ? (
            <ul className="mt-3 space-y-1.5">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between rounded-lg border border-line-soft bg-control px-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate text-ink-body">{k.device_label ?? "Passkey"}</span>
                    <span className="block text-[11px] text-ink-soft">
                      {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString("en-GB")}` : "Never used"}
                    </span>
                  </span>
                  <button onClick={() => remove(k.id)} className="shrink-0 text-[12px] text-oranje">Remove</button>
                </li>
              ))}
            </ul>
          ) : loaded ? (
            <p className="mt-3 text-[12.5px] text-ink-soft">No passkeys yet.</p>
          ) : (
            <p className="mt-3 text-[12.5px] text-ink-soft">Loading…</p>
          )}

          {msg ? <p className="mt-3 text-[12px] text-ink-body">{msg}</p> : null}

          <button
            onClick={enrol}
            disabled={busy}
            className="tap mt-4 w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-60"
          >
            {busy ? "Waiting for device…" : "Add a passkey for this device"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
