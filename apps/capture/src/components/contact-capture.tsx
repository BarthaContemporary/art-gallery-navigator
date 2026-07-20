"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { uploadToCaptures } from "@/lib/browser";
import { AddressLookup } from "@/components/address-lookup";
import { SwipeToDelete } from "@/components/swipe-to-delete";
import { IconIdCard, IconCheck } from "@/components/icons";

type RecentContact = { id: string; name: string; sub: string };

type Fields = {
  first_name: string;
  last_name: string;
  organization: string;
  email: string;
  phone: string;
  contact_type: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  country: string;
  instagram_handle: string;
  notes: string;
};

const EMPTY: Fields = {
  first_name: "",
  last_name: "",
  organization: "",
  email: "",
  phone: "",
  contact_type: "collector",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  country: "",
  instagram_handle: "",
  notes: "",
};

const TYPES = [
  ["collector", "Collector"],
  ["museum", "Museum"],
  ["dealer", "Dealer"],
  ["auction_house", "Auction house"],
  ["shipper", "Shipper"],
  ["restorer", "Restorer"],
  ["press", "Press"],
] as const;

export function ContactCapture({ recentContacts = [] }: { recentContacts?: RecentContact[] }) {
  const [f, setF] = useState<Fields>(EMPTY);
  const [scanning, setScanning] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [recent, setRecent] = useState<RecentContact[]>(recentContacts);
  const fileRef = useRef<HTMLInputElement>(null);

  async function deleteRecent(id: string) {
    setRecent((r) => r.filter((c) => c.id !== id));
    await fetch(`/api/capture/contact/${id}`, { method: "DELETE" });
  }

  function set<K extends keyof Fields>(k: K, v: Fields[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }
  // Editing an address field by hand clears the "verified" flag.
  function setAddr<K extends keyof Fields>(k: K, v: Fields[K]) {
    set(k, v);
    setVerified(false);
  }

  async function onScan(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setError(null);
    setScanning(true);
    setCardUrl(URL.createObjectURL(file));
    try {
      const { path } = await uploadToCaptures(file, "card");
      const res = await fetch("/api/capture/contact/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = (await res.json()) as { configured?: boolean; fields?: Partial<Fields> | null; error?: string };
      if (data.configured === false) setError("Card scanning is not configured — enter details manually.");
      else if (data.fields) {
        setF((s) => {
          const next = { ...s };
          for (const [k, v] of Object.entries(data.fields as Record<string, string>)) {
            if (v && v.trim() && k in next) (next as Record<string, string>)[k] = v.trim();
          }
          return next;
        });
      }
    } catch {
      setError("Could not scan card — enter details manually.");
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/capture/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const { error: e } = (await res.json()) as { error?: string };
        setError(e ?? "Could not save contact");
        return;
      }
      const { contact } = (await res.json()) as {
        contact?: { id: string; first_name: string | null; last_name: string | null };
      };
      const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || f.organization || "Contact";
      if (contact?.id) setRecent((r) => [{ id: contact.id, name, sub: f.organization }, ...r]);
      setSavedName(name);
    } finally {
      setSaving(false);
    }
  }

  if (savedName) {
    return (
      <div className="pt-10 text-center">
        <IconCheck className="mx-auto h-12 w-12 text-status-green" />
        <h1 className="mt-2 text-[19px] font-bold text-ink-strong">{savedName} added to contacts</h1>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => {
              setF(EMPTY);
              setCardUrl(null);
              setSavedName(null);
            }}
            className="tap flex items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg"
          >
            Add another
          </button>
          <Link href="/" className="tap flex items-center justify-center rounded-xl border border-line-control bg-control font-medium text-ink-body">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const canSave = Boolean(f.first_name.trim() || f.last_name.trim() || f.organization.trim() || f.email.trim());

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold tracking-[-0.01em] text-ink-strong">New contact</h1>
        <Link href="/" className="text-[12px] text-ink-soft">Home</Link>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onScan(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-cell font-semibold text-ink-body disabled:opacity-60"
      >
        <IconIdCard className="h-5 w-5" />
        {scanning ? "Reading card…" : "Scan business card"}
      </button>

      {cardUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardUrl} alt="" className="max-h-40 w-full object-contain" />
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">{error}</p> : null}

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <F label="First name" v={f.first_name} on={(v) => set("first_name", v)} />
          <F label="Last name" v={f.last_name} on={(v) => set("last_name", v)} />
        </div>
        <F label="Organisation" v={f.organization} on={(v) => set("organization", v)} />
        <F label="Email" v={f.email} on={(v) => set("email", v)} inputMode="email" />
        <F label="Phone" v={f.phone} on={(v) => set("phone", v)} />

        <div>
          <span className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">Type</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TYPES.map(([v, l]) => (
              <button
                key={v}
                onClick={() => set("contact_type", v)}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  f.contact_type === v ? "border-oranje bg-oranje/10 text-oranje" : "border-line-control bg-cell text-ink-mid"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Address — Google lookup fills + validates; fields stay editable */}
        <div className="rounded-xl border border-line-soft bg-cell p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-body">Address</span>
            {verified ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-status-green">
                <IconCheck className="h-3.5 w-3.5" /> Verified by Google
              </span>
            ) : null}
          </div>
          <div className="mt-2 space-y-3">
            <AddressLookup
              onPick={(p) => {
                setF((s) => ({
                  ...s,
                  address_line1: p.line1 || s.address_line1,
                  address_line2: p.line2 || s.address_line2,
                  city: p.city || s.city,
                  postcode: p.postcode || s.postcode,
                  country: p.country || s.country,
                  organization: p.company || s.organization,
                }));
                setVerified(true);
              }}
            />
            <F label="Address line 1" v={f.address_line1} on={(v) => setAddr("address_line1", v)} />
            <F label="Address line 2" v={f.address_line2} on={(v) => setAddr("address_line2", v)} />
            <div className="grid grid-cols-2 gap-3">
              <F label="City" v={f.city} on={(v) => setAddr("city", v)} />
              <F label="Postcode" v={f.postcode} on={(v) => setAddr("postcode", v)} />
            </div>
            <F label="Country" v={f.country} on={(v) => setAddr("country", v)} />
          </div>
        </div>

        <F label="Instagram" v={f.instagram_handle} on={(v) => set("instagram_handle", v)} />
        <F label="Notes" v={f.notes} on={(v) => set("notes", v)} textarea />

        {recent.length ? (
          <div className="mt-6">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Recently added</h2>
            <p className="mt-1 text-[11.5px] text-ink-soft">Swipe a row left to delete.</p>
            <div className="mt-2 space-y-2">
              {recent.map((c) => (
                <SwipeToDelete key={c.id} confirmText={`Delete ${c.name} from contacts?`} onDelete={() => deleteRecent(c.id)}>
                  <div className="rounded-2xl border border-line bg-cell px-4 py-3">
                    <span className="block truncate text-[14px] text-ink-body">{c.name}</span>
                    {c.sub ? <span className="block text-[12px] text-ink-soft">{c.sub}</span> : null}
                  </div>
                </SwipeToDelete>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="safe-bottom sticky bottom-0 mt-6 border-t border-line-soft bg-page/90 py-3 backdrop-blur">
        <button onClick={save} disabled={!canSave || saving} className="tap w-full rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">
          {saving ? "Saving…" : "Add to contacts"}
        </button>
      </div>
    </div>
  );
}

function F({
  label,
  v,
  on,
  inputMode,
  textarea,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  inputMode?: "email" | "text";
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">{label}</span>
      {textarea ? (
        <textarea value={v} onChange={(e) => on(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink" />
      ) : (
        <input value={v} inputMode={inputMode} onChange={(e) => on(e.target.value)} className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink" />
      )}
    </label>
  );
}
