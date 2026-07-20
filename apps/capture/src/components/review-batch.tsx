"use client";

import Link from "next/link";
import { useState } from "react";
import { SwipeToDelete } from "@/components/swipe-to-delete";

type Fields = {
  maker: string;
  title: string;
  year: string;
  medium: string;
  dimensions_text: string;
  period: string;
  origin_region: string;
  category: string;
  notes: string;
};

export type ReviewWork = {
  id: string;
  fields: Fields;
  photos: { id: string; url: string; is_label: boolean }[];
  hasInvoice: boolean;
};

export function ReviewBatch({ batchId, initialWorks }: { batchId: string; initialWorks: ReviewWork[] }) {
  const [works, setWorks] = useState(initialWorks);
  const [confirming, setConfirming] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState<{ stockNumbers: string[]; errors: number } | null>(null);

  function setField(workId: string, k: keyof Fields, v: string) {
    setWorks((ws) => ws.map((w) => (w.id === workId ? { ...w, fields: { ...w.fields, [k]: v } } : w)));
  }
  async function removeWork(workId: string) {
    setWorks((ws) => ws.filter((w) => w.id !== workId));
    await fetch(`/api/capture/work?id=${workId}`, { method: "DELETE" });
  }
  async function saveWork(workId: string) {
    const w = works.find((x) => x.id === workId);
    if (!w) return;
    await fetch("/api/capture/work", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: workId, ...w.fields }),
    });
  }

  async function push() {
    setPushing(true);
    try {
      // Persist any edits, then push.
      await Promise.all(works.map((w) => saveWork(w.id)));
      const res = await fetch("/api/capture/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const { results } = (await res.json()) as {
        results?: { stockNumber?: string; error?: string }[];
      };
      const stockNumbers = (results ?? []).map((r) => r.stockNumber).filter(Boolean) as string[];
      const errors = (results ?? []).filter((r) => r.error).length;
      setDone({ stockNumbers, errors });
    } finally {
      setPushing(false);
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <div className="pt-8 text-center">
        <p className="text-[40px]">✓</p>
        <h2 className="mt-2 text-[18px] font-bold text-ink-strong">
          {done.stockNumbers.length} added to inventory
        </h2>
        <p className="mt-1 text-[12.5px] text-ink-muted">Marked “needs completion” for finishing in the studio.</p>
        {done.stockNumbers.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {done.stockNumbers.map((s) => (
              <span key={s} className="rounded-full border border-line-control bg-control px-2.5 py-1 font-mono text-[12px] text-ink-body">
                {s}
              </span>
            ))}
          </div>
        ) : null}
        {done.errors ? <p className="mt-3 text-[12px] text-oranje">{done.errors} could not be pushed.</p> : null}
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/review" className="tap flex items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg">
            Back to review
          </Link>
          <Link href="/" className="tap flex items-center justify-center rounded-xl border border-line-control bg-control font-medium text-ink-body">
            Home
          </Link>
        </div>
      </div>
    );
  }

  if (works.length === 0) {
    return <p className="mt-8 text-center text-[13px] text-ink-soft">All works in this batch have been pushed.</p>;
  }

  return (
    <div className="mt-4">
      <div className="space-y-5">
        {works.map((w, i) => (
          <SwipeToDelete key={w.id} confirmText="Delete this work and its photos?" onDelete={() => removeWork(w.id)}>
          <section className="rounded-2xl border border-line bg-cell p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Work {i + 1}</h2>
              <span className={`text-[11px] ${w.hasInvoice ? "text-status-green" : "text-ink-soft"}`}>
                {w.hasInvoice ? "🧾 invoice linked" : "no invoice"}
              </span>
            </div>

            {w.photos.length ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {w.photos.map((p) => (
                  <div key={p.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-band">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    {p.is_label ? (
                      <span className="absolute left-0.5 top-0.5 rounded bg-oranje px-1 text-[8px] font-semibold uppercase text-white">L</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-3 space-y-3">
              <F label="Maker" v={w.fields.maker} on={(v) => setField(w.id, "maker", v)} blur={() => saveWork(w.id)} />
              <F label="Title" v={w.fields.title} on={(v) => setField(w.id, "title", v)} blur={() => saveWork(w.id)} />
              <div className="grid grid-cols-2 gap-3">
                <F label="Year" v={w.fields.year} on={(v) => setField(w.id, "year", v)} blur={() => saveWork(w.id)} />
                <F label="Dimensions" v={w.fields.dimensions_text} on={(v) => setField(w.id, "dimensions_text", v)} blur={() => saveWork(w.id)} />
              </div>
              <F label="Medium" v={w.fields.medium} on={(v) => setField(w.id, "medium", v)} blur={() => saveWork(w.id)} />
              <div className="grid grid-cols-2 gap-3">
                <F label="Period" v={w.fields.period} on={(v) => setField(w.id, "period", v)} blur={() => saveWork(w.id)} />
                <F label="Origin" v={w.fields.origin_region} on={(v) => setField(w.id, "origin_region", v)} blur={() => saveWork(w.id)} />
              </div>
              <F label="Notes" v={w.fields.notes} on={(v) => setField(w.id, "notes", v)} blur={() => saveWork(w.id)} textarea />
            </div>
          </section>
          </SwipeToDelete>
        ))}
      </div>

      {!works.some((w) => w.hasInvoice) ? (
        <Link
          href={`/invoices/new?batch=${batchId}`}
          className="tap mt-4 flex w-full items-center justify-center rounded-xl border border-dashed border-line-control bg-cell font-medium text-ink-body"
        >
          🧾 Add an invoice to this purchase
        </Link>
      ) : null}

      <div className="safe-bottom sticky bottom-0 mt-6 border-t border-line-soft bg-page/90 py-3 backdrop-blur">
        <button
          onClick={() => setConfirming(true)}
          className="tap w-full rounded-xl bg-primary font-semibold text-primary-fg"
        >
          Push {works.length} work(s) to inventory
        </button>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => !pushing && setConfirming(false)}>
          <div className="w-full max-w-[440px] rounded-2xl border border-line bg-page p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold text-ink-strong">Add to inventory?</h3>
            <p className="mt-1.5 text-[13px] text-ink-body">
              {works.length} work(s) will be created as stock records, flagged{" "}
              <b>needs completion</b>. Photos and any linked invoice are attached automatically.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={pushing}
                className="tap flex-1 rounded-xl border border-line-control bg-control font-medium text-ink-body disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={push}
                disabled={pushing}
                className="tap flex-1 rounded-xl bg-primary font-semibold text-primary-fg disabled:opacity-50"
              >
                {pushing ? "Pushing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function F({
  label,
  v,
  on,
  blur,
  textarea,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  blur: () => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">{label}</span>
      {textarea ? (
        <textarea value={v} onChange={(e) => on(e.target.value)} onBlur={blur} rows={2} className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink" />
      ) : (
        <input value={v} onChange={(e) => on(e.target.value)} onBlur={blur} className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink" />
      )}
    </label>
  );
}
