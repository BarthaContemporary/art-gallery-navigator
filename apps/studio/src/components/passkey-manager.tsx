"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

type Passkey = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

function suggestLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  return "This device";
}

/**
 * "Passkeys" section on the Admin page: enrol the current device (Face ID /
 * Touch ID; the passkey syncs across the user's iCloud Keychain) and manage
 * existing ones. Available to every signed-in studio user.
 */
export function PasskeyManager() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/passkeys");
      const json = (await res.json()) as { passkeys?: Passkey[] };
      setKeys(json.passkeys ?? []);
    } catch {
      setKeys([]);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  async function addDevice() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const optRes = await fetch("/api/passkeys/register-options", { method: "POST" });
      const optionsJSON = await optRes.json();
      if (!optRes.ok) throw new Error(optionsJSON.error ?? "Could not start");
      const attestation = await startRegistration({ optionsJSON });
      const res = await fetch("/api/passkeys/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation, label: suggestLabel() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not save the passkey");
      setMsg("Passkey added — it syncs to your other Apple devices via iCloud Keychain.");
      await refresh();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError")
        setMsg(e instanceof Error ? e.message : "Could not add the passkey");
    } finally {
      setBusy(false);
    }
  }

  async function remove(k: Passkey) {
    if (!window.confirm(`Remove the passkey “${k.device_label ?? "unnamed"}”? Devices using it will need the password (or another passkey) to sign in.`))
      return;
    await fetch(`/api/passkeys?id=${k.id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <section className="mt-8 max-w-md rounded-[11px] border border-line bg-cell p-5">
      <h2 className="text-[13px] font-semibold text-ink-strong">Passkeys</h2>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        Sign in with Face ID / Touch ID instead of the password. Add it once — iCloud Keychain
        makes it available on your Mac, iPhone and iPad.
      </p>
      {msg ? <p className="mt-3 text-[12.5px] text-ink-body">{msg}</p> : null}
      <ul className="mt-3 space-y-2">
        {(keys ?? []).map((k) => (
          <li key={k.id} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2">
            <span className="text-[13px] text-ink-body">
              {k.device_label ?? "Passkey"}
              <span className="ml-2 font-mono text-[11px] text-ink-soft">
                added {new Date(k.created_at).toLocaleDateString("en-GB")}
                {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString("en-GB")}` : ""}
              </span>
            </span>
            <button type="button" onClick={() => void remove(k)} className="text-[12px] text-ink-soft hover:text-oranje">
              Remove
            </button>
          </li>
        ))}
        {keys !== null && keys.length === 0 ? (
          <li className="text-[12.5px] text-ink-muted">No passkeys yet.</li>
        ) : null}
      </ul>
      <button
        type="button"
        onClick={() => void addDevice()}
        disabled={busy || keys === null}
        className="mt-4 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-60"
      >
        {busy ? "Follow the prompt…" : "Add a passkey for this device"}
      </button>
    </section>
  );
}
