"use client";

import { useState } from "react";

const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";

/**
 * Origin/region picker: a dropdown of curated regions with an inline
 * "add region" affordance. New regions are saved for reuse elsewhere.
 * Submits the chosen region name as `origin_region` (free text on pieces).
 */
export function OriginSelect({
  options,
  defaultValue,
}: {
  options: string[];
  defaultValue?: string | null;
}) {
  const current = (defaultValue ?? "").trim();
  // Always include the current value so an existing (non-curated) region on a
  // piece isn't silently dropped.
  const initial = current && !options.includes(current) ? [...options, current] : options;

  const [opts, setOpts] = useState<string[]>(initial);
  const [selected, setSelected] = useState(current);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/origin-regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const json = (await res.json()) as { name?: string; error?: string };
      if (!res.ok || !json.name) throw new Error(json.error ?? "Could not add region");
      const value = json.name;
      setOpts((p) => (p.includes(value) ? p : [...p, value]));
      setSelected(value);
      setName("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add region");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        name="origin_region"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={field}
      >
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      {adding ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="New region"
            className="flex-1 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink-body"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void add()}
            className="rounded-md border border-oranje bg-oranje/10 px-2.5 py-1 text-[12px] font-semibold text-oranje disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setName("");
              setError(null);
            }}
            className="text-[12px] text-ink-muted hover:text-ink-strong"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1.5 text-[12px] font-medium text-oranje"
        >
          + Add region
        </button>
      )}
      {error ? <p className="mt-1 text-[12px] text-ink-body">{error}</p> : null}
    </div>
  );
}
