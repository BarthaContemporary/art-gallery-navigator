"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { uploadToCaptures } from "@/lib/browser";
import { squareUp, type Geo } from "@/lib/square";
import { InventoryLinkPicker, type PieceHit } from "@/components/inventory-link-picker";
import { SwipeToDelete } from "@/components/swipe-to-delete";

type CandidateWork = { id: string; label: string; sub: string };
type RecentInvoice = { id: string; label: string; sub: string };
type Page = { id: string; url: string; pageNo: number; uploading?: boolean; squared?: boolean };
type Header = { vendor: string; reference: string; invoice_date: string; total: string; currency: string; notes: string };

const EMPTY: Header = { vendor: "", reference: "", invoice_date: "", total: "", currency: "GBP", notes: "" };

export function InvoiceCapture({
  batchId,
  candidateWorks,
  recentInvoices = [],
}: {
  batchId: string | null;
  candidateWorks: CandidateWork[];
  recentInvoices?: RecentInvoice[];
}) {
  const [recent, setRecent] = useState<RecentInvoice[]>(recentInvoices);
  async function deleteRecent(id: string) {
    setRecent((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/capture/invoice/${id}`, { method: "DELETE" });
  }
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [header, setHeader] = useState<Header>(EMPTY);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [selectedWorks, setSelectedWorks] = useState<string[]>(candidateWorks.map((w) => w.id));
  const [selectedPieces, setSelectedPieces] = useState<PieceHit[]>([]);
  const [saved, setSaved] = useState(false);

  // Keep original File objects around so we can square them after processing.
  const files = useRef<Map<string, File>>(new Map());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const res = await fetch("/api/capture/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const { invoice } = (await res.json()) as { invoice?: { id: string } };
      if (invoice) setInvoiceId(invoice.id);
    })();
  }, [batchId]);

  async function onPickPages(list: FileList | null) {
    if (!list || !invoiceId) return;
    for (const file of Array.from(list)) {
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
      const localUrl = URL.createObjectURL(file);
      const pageNo = pages.length + 1;
      setPages((p) => [...p, { id: tempId, url: localUrl, pageNo, uploading: true }]);
      try {
        const { path } = await uploadToCaptures(file, "invoice", { invoiceId });
        const res = await fetch(`/api/capture/invoice/${invoiceId}/page`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path, pageNo }),
        });
        const { page, url } = (await res.json()) as { page?: { id: string }; url?: string };
        const realId = page?.id ?? tempId;
        if (page?.id) files.current.set(page.id, file);
        setPages((ps) => ps.map((p) => (p.id === tempId ? { id: realId, url: url ?? localUrl, pageNo, uploading: false } : p)));
      } catch {
        setPages((ps) => ps.filter((p) => p.id !== tempId));
      }
    }
  }

  async function process() {
    if (!invoiceId || pages.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/capture/invoice/${invoiceId}/process`, { method: "POST" });
      const data = (await res.json()) as {
        configured?: boolean;
        geometry?: { pageId: string; geo: Geo | null }[];
        vendor?: string;
        reference?: string;
        invoice_date?: string;
        total?: string | number;
        currency?: string;
      };
      if (data.configured !== false) {
        setHeader((h) => ({
          ...h,
          vendor: data.vendor ? String(data.vendor) : h.vendor,
          reference: data.reference ? String(data.reference) : h.reference,
          invoice_date: data.invoice_date ? String(data.invoice_date) : h.invoice_date,
          total: data.total ? String(data.total) : h.total,
          currency: data.currency ? String(data.currency) : h.currency,
        }));
        // Square up each page in the browser using the returned geometry.
        for (const g of data.geometry ?? []) {
          const original = files.current.get(g.pageId);
          if (!original || !g.geo) continue;
          const squared = await squareUp(original, g.geo);
          if (!squared) continue;
          try {
            const { path } = await uploadToCaptures(squared, "invoice", { invoiceId });
            await fetch(`/api/capture/invoice/${invoiceId}/page`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ pageId: g.pageId, squaredPath: path }),
            });
            setPages((ps) => ps.map((p) => (p.id === g.pageId ? { ...p, squared: true } : p)));
          } catch {
            /* keep original if squared upload fails */
          }
        }
      }
      setProcessed(true);
    } finally {
      setProcessing(false);
    }
  }

  async function saveHeader(next: Header) {
    if (!invoiceId) return;
    await fetch(`/api/capture/invoice/${invoiceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function save() {
    if (!invoiceId) return;
    await saveHeader(header);
    await fetch(`/api/capture/invoice/${invoiceId}/link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workIds: selectedWorks, pieceIds: selectedPieces.map((p) => p.id) }),
    });
    setSaved(true);
  }

  function set<K extends keyof Header>(k: K, v: Header[K]) {
    setHeader((h) => ({ ...h, [k]: v }));
  }

  const fileRef = useRef<HTMLInputElement>(null);

  if (saved) {
    return (
      <div className="pt-10 text-center">
        <p className="text-[40px]">✓</p>
        <h1 className="mt-2 text-[19px] font-bold text-ink-strong">Invoice saved</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Linked to {selectedWorks.length} captured work(s) and {selectedPieces.length} inventory item(s).
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/invoices/new" className="tap flex items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg">
            Another invoice
          </Link>
          <Link href="/" className="tap flex items-center justify-center rounded-xl border border-line-control bg-control font-medium text-ink-body">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold tracking-[-0.01em] text-ink-strong">New invoice</h1>
        <Link href="/" className="text-[12px] text-ink-soft">Home</Link>
      </div>

      {/* Pages */}
      <section className="mt-4 rounded-2xl border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Pages</h2>
        {pages.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {pages.map((p) => (
              <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-band">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className={`h-full w-full object-cover ${p.uploading ? "opacity-50" : ""}`} />
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  {p.squared ? "Squared" : `p.${p.pageNo}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12.5px] text-ink-soft">Photograph each page of the invoice.</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            onPickPages(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <div className="mt-3 flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="tap flex-1 rounded-xl border border-line-control bg-control font-medium text-ink-body active:bg-control-active">
            📷 Add page
          </button>
          <button
            onClick={process}
            disabled={processing || pages.length === 0}
            className="tap rounded-xl bg-primary px-5 font-semibold text-primary-fg disabled:opacity-50"
          >
            {processing ? "Reading…" : processed ? "Re-read" : "Read invoice"}
          </button>
        </div>
      </section>

      {/* Header fields */}
      <section className="mt-4 rounded-2xl border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Details</h2>
        <div className="mt-3 space-y-3">
          <Field label="Vendor" value={header.vendor} onChange={(v) => set("vendor", v)} onBlur={() => saveHeader(header)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reference" value={header.reference} onChange={(v) => set("reference", v)} onBlur={() => saveHeader(header)} />
            <Field label="Date" value={header.invoice_date} onChange={(v) => set("invoice_date", v)} onBlur={() => saveHeader(header)} type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total" value={header.total} onChange={(v) => set("total", v)} onBlur={() => saveHeader(header)} inputMode="decimal" />
            <Field label="Currency" value={header.currency} onChange={(v) => set("currency", v.toUpperCase())} onBlur={() => saveHeader(header)} />
          </div>
        </div>
      </section>

      {/* Link to works / inventory */}
      <section className="mt-4 rounded-2xl border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Relates to</h2>
        {candidateWorks.length ? (
          <div className="mt-3">
            <p className="text-[12px] text-ink-muted">Recently captured works</p>
            <div className="mt-2 space-y-1.5">
              {candidateWorks.map((w) => {
                const on = selectedWorks.includes(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() =>
                      setSelectedWorks((s) => (on ? s.filter((x) => x !== w.id) : [...s, w.id]))
                    }
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                      on ? "border-oranje bg-oranje/5" : "border-line-control bg-control"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-[12px] ${on ? "border-oranje bg-oranje text-white" : "border-line-control"}`}>
                      {on ? "✓" : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-ink-body">{w.label}</span>
                      {w.sub ? <span className="block text-[11.5px] text-ink-soft">{w.sub}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[12.5px] text-ink-soft">No recent captured works.</p>
        )}

        <div className="mt-4">
          <p className="text-[12px] text-ink-muted">Existing inventory</p>
          <InventoryLinkPicker selected={selectedPieces} onChange={setSelectedPieces} />
        </div>
      </section>

      {recent.length ? (
        <section className="mt-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Recent invoices</h2>
          <p className="mt-1 text-[11.5px] text-ink-soft">Swipe a row left to delete.</p>
          <div className="mt-2 space-y-2">
            {recent.map((iv) => (
              <SwipeToDelete key={iv.id} confirmText="Delete this invoice and its pages?" onDelete={() => deleteRecent(iv.id)}>
                <div className="rounded-2xl border border-line bg-cell px-4 py-3">
                  <span className="block truncate text-[14px] text-ink-body">{iv.label}</span>
                  {iv.sub ? <span className="block text-[12px] text-ink-soft">{iv.sub}</span> : null}
                </div>
              </SwipeToDelete>
            ))}
          </div>
        </section>
      ) : null}

      <div className="safe-bottom sticky bottom-0 mt-6 flex gap-2 border-t border-line-soft bg-page/90 py-3 backdrop-blur">
        <button onClick={save} disabled={!invoiceId} className="tap flex-1 rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50">
          Save invoice
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  type?: string;
  inputMode?: "decimal" | "email" | "text";
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">{label}</span>
      <input
        value={value}
        type={type}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink"
      />
    </label>
  );
}
