"use client";

import { useState } from "react";

type Source = { name: string | null; address: string | null; type: string | null };

const TYPES = [
  { v: "gallery", l: "Gallery" },
  { v: "dealer", l: "Dealer" },
  { v: "auction", l: "Auction" },
  { v: "fair", l: "Fair" },
  { v: "private", l: "Private" },
  { v: "other", l: "Other" },
];

const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Shows the auto-captured purchase date + resolved source (gallery / dealer /
 * auction), tap-to-edit. Saves to the batch as the user types.
 */
export function SourceBar({
  batchId,
  source,
  onChange,
}: {
  batchId: string;
  source: Source;
  onChange: (s: Source) => void;
}) {
  const [open, setOpen] = useState(false);

  async function save(patch: Partial<Source>) {
    const next = { ...source, ...patch };
    onChange(next);
    await fetch(`/api/capture/batch/${batchId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source_name: next.name,
        source_type: next.type,
        source_address: next.address,
      }),
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-band px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">
            Purchased · {today}
          </p>
          <p className="mt-0.5 truncate text-[14px] text-ink-body">
            {source.name || source.address || "Location not set"}
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-[12px] font-medium text-oranje">
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 border-t border-line-soft pt-3">
          <input
            defaultValue={source.name ?? ""}
            placeholder="Gallery / dealer / auction house name"
            onBlur={(e) => save({ name: e.target.value.trim() || null })}
            className="w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink"
          />
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.v}
                onClick={() => save({ type: t.v })}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  source.type === t.v
                    ? "border-oranje bg-oranje/10 text-oranje"
                    : "border-line-control bg-cell text-ink-mid"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
          <input
            defaultValue={source.address ?? ""}
            placeholder="Address (optional)"
            onBlur={(e) => save({ address: e.target.value.trim() || null })}
            className="w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink"
          />
        </div>
      ) : null}
    </div>
  );
}
