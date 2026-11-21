"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { makeThumbnail, uploadToCaptures } from "@/lib/browser";
import { squareUp, type Geo } from "@/lib/square";
import { jsonBody, messageOf, requestJson } from "@/lib/request";
import { InventoryLinkPicker, type PieceHit } from "@/components/inventory-link-picker";
import { SwipeToDelete } from "@/components/swipe-to-delete";
import { IconCamera, IconCheck } from "@/components/icons";

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
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [header, setHeader] = useState<Header>(EMPTY);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  // Opened for one purchase, its works are ticked; opened from Home, the
  // list holds recent drafts of every purchase, so none is ticked for you.
  const [selectedWorks, setSelectedWorks] = useState<string[]>(batchId ? candidateWorks.map((w) => w.id) : []);
  const [selectedPieces, setSelectedPieces] = useState<PieceHit[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ attached: number; forAdmin: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // Keep original File objects around so we can square them after processing.
  const files = useRef<Map<string, File>>(new Map());
  const invoiceRef = useRef<string | null>(null);
  const creating = useRef<Promise<string> | null>(null);
  const nextPageNo = useRef(1);
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
    };
  }, []);

  async function deleteRecent(id: string) {
    const before = recent;
    setRecent((r) => r.filter((x) => x.id !== id));
    try {
      await requestJson(`/api/capture/invoice/${id}`, { method: "DELETE" });
    } catch (e) {
      setRecent(before);
      setError(messageOf(e, "The invoice could not be deleted. Try again."));
    }
  }

  /**
   * The invoice row, created on first use (the first page or Save), not on
   * opening the screen, so a visit that captures nothing leaves nothing.
   */
  async function ensureInvoice(): Promise<string> {
    if (invoiceRef.current) return invoiceRef.current;
    creating.current ??= requestJson<{ invoice?: { id: string } }>("/api/capture/invoice", jsonBody("POST", { batchId }))
      .then(({ invoice }) => {
        if (!invoice?.id) throw new Error("The invoice could not be started. Try again.");
        invoiceRef.current = invoice.id;
        setInvoiceId(invoice.id);
        return invoice.id;
      })
      .finally(() => {
        creating.current = null;
      });
    return creating.current;
  }

  async function onPickPages(list: FileList | null) {
    if (!list) return;
    setError(null);
    let id: string;
    try {
      id = await ensureInvoice();
    } catch (e) {
      setError(messageOf(e, "The invoice could not be started. Try again."));
      return;
    }
    for (const file of Array.from(list)) {
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
      const pageNo = nextPageNo.current++;
      const preview = await makeThumbnail(file, 480);
      previews.current.add(preview);
      setPages((p) => [...p, { id: tempId, url: preview, pageNo, uploading: true }]);
      try {
        const { path } = await uploadToCaptures(file, "invoice", { invoiceId: id });
        const { page } = await requestJson<{ page?: { id: string } }>(
          `/api/capture/invoice/${id}/page`,
          jsonBody("POST", { path, pageNo }),
        );
        if (!page?.id) throw new Error("The page was not recorded.");
        files.current.set(page.id, file);
        setPages((ps) => ps.map((p) => (p.id === tempId ? { ...p, id: page.id, uploading: false } : p)));
      } catch (e) {
        setPages((ps) => ps.filter((p) => p.id !== tempId));
        setError(`Page ${pageNo} was not saved (${messageOf(e, "try again")}). Photograph it again.`);
      }
    }
  }

  async function process() {
    if (!invoiceId || pages.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const data = await requestJson<{
        configured?: boolean;
        geometry?: { pageId: string; geo: Geo | null }[];
        vendor?: string;
        reference?: string;
        invoice_date?: string;
        total?: string | number;
        currency?: string;
      }>(`/api/capture/invoice/${invoiceId}/process`, { method: "POST" });
      if (data.configured === false) {
        setError("Invoice reading is not set up — enter the details below.");
        return;
      }
      setHeader((h) => ({
        ...h,
        vendor: data.vendor ? String(data.vendor) : h.vendor,
        reference: data.reference ? String(data.reference) : h.reference,
        invoice_date: data.invoice_date ? String(data.invoice_date) : h.invoice_date,
        total: data.total ? String(data.total) : h.total,
        currency: data.currency ? String(data.currency) : h.currency,
      }));
      // Square up each page in the browser using the returned geometry; the
      // page then shows the squared version, so it can be checked.
      let failed = 0;
      for (const g of data.geometry ?? []) {
        const original = files.current.get(g.pageId);
        if (!original || !g.geo) continue;
        const squared = await squareUp(original, g.geo);
        if (!squared) continue;
        try {
          const { path } = await uploadToCaptures(squared, "invoice", { invoiceId });
          await requestJson(`/api/capture/invoice/${invoiceId}/page`, jsonBody("PATCH", { pageId: g.pageId, squaredPath: path }));
          const preview = await makeThumbnail(squared, 480);
          previews.current.add(preview);
          setPages((ps) => ps.map((p) => (p.id === g.pageId ? { ...p, url: preview, squared: true } : p)));
        } catch {
          failed++; // the original page stays the one attached
        }
      }
      if (failed) setError(`${failed} squared page(s) could not be saved; the original photo is kept.`);
      setProcessed(true);
    } catch (e) {
      setError(messageOf(e, "The invoice could not be read. Try again."));
    } finally {
      setProcessing(false);
    }
  }

  async function saveHeader(next: Header): Promise<boolean> {
    const id = invoiceRef.current;
    if (!id) return true; // nothing to save to yet: Save creates it
    try {
      await requestJson(`/api/capture/invoice/${id}`, jsonBody("PATCH", next));
      setHeaderError(null);
      return true;
    } catch (e) {
      setHeaderError(messageOf(e, "Not saved. Try again."));
      return false;
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const id = await ensureInvoice();
      if (!(await saveHeader(header))) return;
      const res = await requestJson<{ attached?: number; notAttached?: string[]; forAdmin?: number }>(
        `/api/capture/invoice/${id}/link`,
        jsonBody("POST", { workIds: selectedWorks, pieceIds: selectedPieces.map((p) => p.id) }),
      );
      const missed = res.notAttached?.length ?? 0;
      if (missed) {
        // The links are saved; attaching is safe to repeat.
        setError(
          `Saved, but ${missed} inventory item(s) did not receive the invoice. Tap Save invoice to try again.`,
        );
        return;
      }
      setSaved({ attached: res.attached ?? 0, forAdmin: res.forAdmin ?? 0 });
    } catch (e) {
      setError(messageOf(e, "The invoice could not be saved. Try again."));
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof Header>(k: K, v: Header[K]) {
    setHeader((h) => ({ ...h, [k]: v }));
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = pages.some((p) => p.uploading);

  if (saved) {
    return (
      <div className="pt-10 text-center">
        <IconCheck className="mx-auto h-12 w-12 text-status-green" />
        <h1 className="mt-2 text-[19px] font-bold text-ink-strong">Invoice saved</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Linked to {selectedWorks.length} captured work(s) and {selectedPieces.length} inventory item(s).
        </p>
        {selectedPieces.length && !saved.forAdmin ? (
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {saved.attached} inventory item(s) now carry it as their purchase invoice.
          </p>
        ) : null}
        {saved.forAdmin ? (
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Only an admin can put a purchase invoice and its figures on an existing inventory item: ask one to add it
            to {saved.forAdmin === 1 ? "that item" : `those ${saved.forAdmin} items`} in the studio.
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={batchId ? `/invoices/new?batch=${batchId}` : "/invoices/new"}
            className="tap flex items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg"
          >
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

      {error ? (
        <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-danger">{error}</p>
      ) : null}

      {/* Pages */}
      <section className="mt-4 rounded-2xl border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Pages</h2>
        {pages.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {pages.map((p) => (
              <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-band">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  decoding="async"
                  className={`h-full w-full ${p.squared ? "object-contain" : "object-cover"} ${p.uploading ? "opacity-50" : ""}`}
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  {p.squared ? `p.${p.pageNo} · squared` : `p.${p.pageNo}`}
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
          <button onClick={() => fileRef.current?.click()} className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border border-line-control bg-control font-medium text-ink-body active:bg-control-active">
            <IconCamera className="h-[18px] w-[18px]" /> Add page
          </button>
          <button
            onClick={process}
            disabled={processing || uploading || !invoiceId || pages.length === 0}
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
          {headerError ? <p className="text-[12px] text-danger">{headerError}</p> : null}
        </div>
      </section>

      {/* Link to works / inventory */}
      <section className="mt-4 rounded-2xl border border-line bg-cell p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Relates to</h2>
        {candidateWorks.length ? (
          <div className="mt-3">
            <p className="text-[12px] text-ink-muted">
              {batchId ? "Works in this purchase" : "Recently captured works — tick the ones this invoice covers"}
            </p>
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
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-oranje bg-oranje text-white" : "border-line-control"}`}>
                      {on ? <IconCheck className="h-3.5 w-3.5" /> : null}
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
        <button
          onClick={save}
          disabled={saving || uploading}
          className="tap flex-1 rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save invoice"}
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
