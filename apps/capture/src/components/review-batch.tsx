"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { jsonBody, messageOf, requestJson } from "@/lib/request";
import { SwipeToDelete } from "@/components/swipe-to-delete";
import { IconReceipt, IconCheck } from "@/components/icons";

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
  /** Set when an earlier push already created the stock record but did not finish. */
  stockNumber: string | null;
};

type PushResult = {
  workId: string;
  stockNumber?: string;
  photosFailed?: number;
  invoiceFailed?: boolean;
  incomplete?: boolean;
  busy?: boolean;
  skipped?: boolean;
  error?: string;
};

type Done = {
  added: string[];
  unfinished: { label: string; why: string }[];
  busy: number;
  skipped: number;
};

const isEmpty = (w: ReviewWork) => w.photos.length === 0 && Object.values(w.fields).every((v) => !v.trim());

export function ReviewBatch({ batchId, initialWorks }: { batchId: string; initialWorks: ReviewWork[] }) {
  const router = useRouter();
  const [works, setWorks] = useState(initialWorks);
  // After a push the page is reloaded from the server: take its list.
  useEffect(() => setWorks(initialWorks), [initialWorks]);
  const [confirming, setConfirming] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setField(workId: string, k: keyof Fields, v: string) {
    setWorks((ws) => ws.map((w) => (w.id === workId ? { ...w, fields: { ...w.fields, [k]: v } } : w)));
  }
  async function removeWork(workId: string) {
    const before = works;
    setWorks((ws) => ws.filter((w) => w.id !== workId));
    try {
      await requestJson(`/api/capture/work?id=${encodeURIComponent(workId)}`, { method: "DELETE" });
    } catch (e) {
      setWorks(before);
      setError(messageOf(e, "The work could not be deleted. Try again."));
    }
  }
  async function saveWork(workId: string): Promise<boolean> {
    const w = works.find((x) => x.id === workId);
    if (!w) return true;
    try {
      await requestJson("/api/capture/work", jsonBody("PATCH", { id: workId, ...w.fields }));
      return true;
    } catch (e) {
      setError(messageOf(e, "An edit could not be saved. Try again."));
      return false;
    }
  }

  async function push() {
    setPushing(true);
    setError(null);
    let sent = false;
    try {
      // Persist any edits first: the push reads the saved works.
      const saved = await Promise.all(works.map((w) => saveWork(w.id)));
      if (saved.includes(false)) return;
      sent = true;
      const { results } = await requestJson<{ results?: PushResult[] }>(
        "/api/capture/push",
        jsonBody("POST", { batchId }),
      );
      const label = (id: string) => {
        const i = works.findIndex((w) => w.id === id);
        const w = works[i];
        return w?.fields.title.trim() || w?.fields.maker.trim() || `Work ${i + 1}`;
      };
      const list = results ?? [];
      setDone({
        added: list.filter((r) => r.stockNumber && !r.incomplete && !r.error).map((r) => r.stockNumber!),
        unfinished: list
          .filter((r) => r.incomplete || r.error)
          .map((r) => ({
            label: r.stockNumber ? `${label(r.workId)} (${r.stockNumber})` : label(r.workId),
            why: r.error
              ? r.error
              : [
                  r.photosFailed ? `${r.photosFailed} photo(s) not copied` : null,
                  r.invoiceFailed ? "invoice not attached" : null,
                ]
                  .filter(Boolean)
                  .join(", "),
          })),
        busy: list.filter((r) => r.busy).length,
        skipped: list.filter((r) => r.skipped).length,
      });
    } catch (e) {
      // The push may have done part of its work: show the batch as it now is.
      setError(`${messageOf(e, "The push did not finish.")} The list below is reloaded; push again to finish.`);
    } finally {
      setPushing(false);
      setConfirming(false);
      // Reload what is still to push (works added leave the list).
      if (sent) router.refresh();
    }
  }

  if (done) {
    const again = done.unfinished.length > 0 || done.busy > 0;
    return (
      <div className="pt-8 text-center">
        <IconCheck className="mx-auto h-12 w-12 text-status-green" />
        <h2 className="mt-2 text-[18px] font-bold text-ink-strong">
          {done.added.length} added to inventory
        </h2>
        <p className="mt-1 text-[12.5px] text-ink-muted">Marked “needs completion” for finishing in the studio.</p>
        {done.added.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {done.added.map((s) => (
              <span key={s} className="rounded-full border border-line-control bg-control px-2.5 py-1 font-mono text-[12px] text-ink-body">
                {s}
              </span>
            ))}
          </div>
        ) : null}
        {done.unfinished.length ? (
          <div className="mt-4 text-left">
            <p className="text-[12.5px] font-semibold text-danger">Not finished — push again to complete:</p>
            <ul className="mt-1 space-y-1 text-[12px] text-ink-body">
              {done.unfinished.map((u, i) => (
                <li key={i}>
                  {u.label}: {u.why}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {done.busy ? (
          <p className="mt-3 text-[12px] text-ink-muted">
            {done.busy} work(s) are being added by another push right now; check again in a few minutes.
          </p>
        ) : null}
        {done.skipped ? (
          <p className="mt-2 text-[12px] text-ink-muted">{done.skipped} empty work(s) left out.</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          {again ? (
            <button
              onClick={() => setDone(null)}
              className="tap flex items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg"
            >
              Back to this purchase
            </button>
          ) : null}
          <Link
            href="/review"
            className={`tap flex items-center justify-center rounded-xl font-semibold ${
              again ? "border border-line-control bg-control text-ink-body" : "bg-primary text-primary-fg"
            }`}
          >
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

  const toAdd = works.filter((w) => !isEmpty(w) || w.stockNumber);
  const empty = works.length - toAdd.length;

  return (
    <div className="mt-4">
      {error ? (
        <p className="mb-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-danger">{error}</p>
      ) : null}
      <div className="space-y-5">
        {works.map((w, i) => (
          <SwipeToDelete key={w.id} confirmText="Delete this work and its photos?" onDelete={() => removeWork(w.id)}>
          <section className="rounded-2xl border border-line bg-cell p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Work {i + 1}</h2>
              <span className={`flex items-center gap-1 text-[11px] ${w.hasInvoice ? "text-status-green" : "text-ink-soft"}`}>
                {w.hasInvoice ? <IconReceipt className="h-3.5 w-3.5" /> : null}
                {w.hasInvoice ? "invoice linked" : "no invoice"}
              </span>
            </div>
            {w.stockNumber ? (
              <p className="mt-1 text-[12px] text-danger">
                Already in inventory as <span className="font-mono">{w.stockNumber}</span>, but not finished: push
                again to add what is missing.
              </p>
            ) : isEmpty(w) ? (
              <p className="mt-1 text-[12px] text-ink-soft">Empty — it will be left out.</p>
            ) : null}

            {w.photos.length ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {w.photos.map((p) => (
                  <div key={p.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-band">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
          className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-control bg-cell font-medium text-ink-body"
        >
          <IconReceipt className="h-[18px] w-[18px]" /> Add an invoice to this purchase
        </Link>
      ) : null}

      <div className="safe-bottom sticky bottom-0 mt-6 border-t border-line-soft bg-page/90 py-3 backdrop-blur">
        <button
          onClick={() => setConfirming(true)}
          className="tap w-full rounded-xl bg-primary font-semibold text-primary-fg"
        >
          Push {toAdd.length} work(s) to inventory
        </button>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => !pushing && setConfirming(false)}>
          <div className="w-full max-w-[440px] rounded-2xl border border-line bg-page p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold text-ink-strong">Add to inventory?</h3>
            <p className="mt-1.5 text-[13px] text-ink-body">
              {toAdd.length} work(s) will be created as stock records, flagged{" "}
              <b>needs completion</b>. Photos and any linked invoice are attached automatically.
              {empty ? ` ${empty} empty work(s) will be left out.` : ""}
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
