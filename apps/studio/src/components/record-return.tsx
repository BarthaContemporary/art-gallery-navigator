"use client";

import { useState } from "react";

const field = "mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";

type PieceLite = { stock_number: string | null; title: string | null };
type Preview = { willReturn: PieceLite[]; writtenOff: PieceLite[]; exported: PieceLite[] };

function List({ label, items, tone }: { label: string; items: PieceLite[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <p className={`text-[11px] font-medium uppercase tracking-[0.06em] ${tone}`}>{label} ({items.length})</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((p, i) => (
          <li key={i} className="text-[12.5px] text-ink-body">
            <span className="font-mono text-[12px] text-ink-muted">{p.stock_number ?? "—"}</span> {p.title ?? "Untitled"}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Two-step temporary-export return: pick a date and preview which items will be
 * returned vs skipped (written off / permanently exported), then confirm.
 * `action` is the server action that actually stamps the return.
 */
export function RecordReturn({
  shipmentId,
  action,
}: {
  shipmentId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    if (!date) {
      setError("Choose a return date first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/return-preview?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error("Could not load preview");
      setPreview((await res.json()) as Preview);
    } catch {
      setError("Could not load the preview — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!preview) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <label className={labelCls}>
          Return date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
        >
          {loading ? "Checking…" : "Record return"}
        </button>
        {error ? <p className="w-full text-[12px] text-ink-body">{error}</p> : null}
      </div>
    );
  }

  const skipped = preview.writtenOff.length + preview.exported.length;
  return (
    <div>
      <p className="text-[13px] text-ink-body">
        <span className="font-semibold">{preview.willReturn.length}</span> item
        {preview.willReturn.length === 1 ? "" : "s"} will be marked returned on{" "}
        <span className="font-mono">{new Date(date).toLocaleDateString("en-GB")}</span>.
      </p>
      <List label="Will be returned" items={preview.willReturn} tone="text-status-green" />
      <List label="Skipped — written off" items={preview.writtenOff} tone="text-ink-soft" />
      <List label="Skipped — permanently exported" items={preview.exported} tone="text-ink-soft" />
      {skipped > 0 ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          {skipped} item{skipped === 1 ? "" : "s"} won’t be returned — they’re accounted for elsewhere
          and will be marked accordingly.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <form action={action}>
          <input type="hidden" name="return_date" value={date} />
          <button
            type="submit"
            disabled={preview.willReturn.length === 0 && skipped === 0}
            className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
          >
            Confirm return
          </button>
        </form>
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-medium text-ink-mid"
        >
          Back
        </button>
      </div>
    </div>
  );
}
