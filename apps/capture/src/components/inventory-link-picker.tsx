"use client";

import { useEffect, useRef, useState } from "react";

export type PieceHit = { id: string; stock_number: string; title: string | null; maker: string | null };

/** Type-ahead search over existing inventory, multi-select chips. */
export function InventoryLinkPicker({
  selected,
  onChange,
}: {
  selected: PieceHit[];
  onChange: (next: PieceHit[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PieceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/capture/inventory/search?q=${encodeURIComponent(q.trim())}`);
        const { results } = (await res.json()) as { results?: PieceHit[] };
        setHits(results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function toggle(hit: PieceHit) {
    const on = selected.some((s) => s.id === hit.id);
    onChange(on ? selected.filter((s) => s.id !== hit.id) : [...selected, hit]);
  }

  return (
    <div className="mt-2">
      {selected.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s)}
              className="flex items-center gap-1.5 rounded-full border border-oranje bg-oranje/10 px-2.5 py-1 text-[12px] text-oranje"
            >
              <span className="font-mono">{s.stock_number}</span> ×
            </button>
          ))}
        </div>
      ) : null}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search stock no. or title…"
        className="w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink"
      />
      {loading ? <p className="mt-1 text-[11.5px] text-ink-soft">Searching…</p> : null}
      {hits.length ? (
        <div className="mt-2 space-y-1">
          {hits.map((h) => {
            const on = selected.some((s) => s.id === h.id);
            return (
              <button
                key={h.id}
                onClick={() => toggle(h)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] ${
                  on ? "border-oranje bg-oranje/5" : "border-line-control bg-cell"
                }`}
              >
                <span className="font-mono text-[12px] text-ink-mid">{h.stock_number}</span>
                <span className="min-w-0 truncate text-ink-body">
                  {[h.maker, h.title].filter(Boolean).join(" — ") || "Untitled"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
