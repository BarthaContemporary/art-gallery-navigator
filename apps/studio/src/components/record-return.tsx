"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";

type PieceLite = { stock_number: string | null; title: string | null };
type Preview = { willReturn: PieceLite[]; writtenOff: PieceLite[]; exported: PieceLite[] };

function List({ label, items, tone }: { label: string; items: PieceLite[]; tone: Tone }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <Badge tone={tone} variant="dot" className="text-[13px] font-semibold">
        {label} ({items.length})
      </Badge>
      <ul className="mt-1 space-y-0.5">
        {items.map((p, i) => (
          <li key={i} className="text-[13px] text-ink">
            <span className="tabular text-body">{p.stock_number ?? "—"}</span> {p.title ?? "Untitled"}
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
      setError("Could not load the preview. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!preview) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`return-date-${shipmentId}`} className="label">
            Return date
          </label>
          <input
            id={`return-date-${shipmentId}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field w-[170px]"
          />
        </div>
        <Button variant="primary" onClick={loadPreview} pending={loading} pendingLabel="Checking…">
          Record return
        </Button>
        {error ? (
          <Notice tone="danger" inline className="w-full">
            {error}
          </Notice>
        ) : null}
      </div>
    );
  }

  const skipped = preview.writtenOff.length + preview.exported.length;
  return (
    <div>
      <p className="text-[13px] text-ink">
        <span className="font-semibold">{preview.willReturn.length}</span> item
        {preview.willReturn.length === 1 ? "" : "s"} will be marked returned on{" "}
        <span className="tabular">{formatDate(date, "numeric")}</span>.
      </p>
      <List label="Will be returned" items={preview.willReturn} tone="ok" />
      <List label="Skipped: written off" items={preview.writtenOff} tone="neutral" />
      <List label="Skipped: permanently exported" items={preview.exported} tone="neutral" />
      {skipped > 0 ? (
        <p className="mt-2 text-[12px] leading-[1.4] text-meta">
          {skipped} item{skipped === 1 ? "" : "s"} won’t be returned. They’re accounted for elsewhere
          and will be marked accordingly.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <form action={action}>
          <input type="hidden" name="return_date" value={date} />
          <Button
            type="submit"
            variant="primary"
            pendingLabel="Recording…"
            disabled={preview.willReturn.length === 0 && skipped === 0}
          >
            Confirm return
          </Button>
        </form>
        <Button onClick={() => setPreview(null)}>Back</Button>
      </div>
    </div>
  );
}
