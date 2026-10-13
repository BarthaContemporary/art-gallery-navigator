"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Notice, type NoticeTone } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";

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
  const [msg, setMsg] = useState<{ tone: NoticeTone; text: string } | null>(null);

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
      setMsg({ tone: "ok", text: "Passkey added. It syncs to your other Apple devices through iCloud Keychain." });
      await refresh();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError")
        setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Could not add the passkey" });
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
    <Section
      title="Passkeys"
      meta="Sign in with Face ID or Touch ID instead of the password. Add it once: iCloud Keychain makes it available on your Mac, iPhone and iPad."
    >
      {msg ? (
        <Notice tone={msg.tone} className="mb-3">
          {msg.text}
        </Notice>
      ) : null}
      <ul>
        {(keys ?? []).map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between gap-3 border-b border-rule py-1.5"
          >
            <span className="min-w-0 text-[13px] text-ink">
              {k.device_label ?? "Passkey"}
              <span className="block text-[12px] text-meta">
                Added {formatDate(k.created_at, "numeric")}
                {k.last_used_at ? ` · last used ${formatDate(k.last_used_at, "numeric")}` : ""}
              </span>
            </span>
            <Button variant="quiet" size="sm" onClick={() => void remove(k)}>
              Remove
            </Button>
          </li>
        ))}
        {keys !== null && keys.length === 0 ? (
          <li className="py-1.5 text-[13px] text-body">No passkeys yet.</li>
        ) : null}
      </ul>
      <Button
        className="mt-3"
        onClick={() => void addDevice()}
        disabled={keys === null}
        pending={busy}
        pendingLabel="Follow the prompt…"
      >
        Add a passkey for this device
      </Button>
    </Section>
  );
}
