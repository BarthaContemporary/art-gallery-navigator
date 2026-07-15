"use client";

import { useState } from "react";

type Option = { id: string; label: string };

const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";

/**
 * Category picker: a dropdown of existing categories with an inline
 * "add category" affordance. New categories are created in the DB and
 * selected immediately. Submits the chosen id as `category_id`.
 */
export function CategorySelect({
  options,
  defaultId,
}: {
  options: Option[];
  defaultId?: string | null;
}) {
  const [opts, setOpts] = useState<Option[]>(options);
  const [selected, setSelected] = useState(defaultId ?? "");
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
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const json = (await res.json()) as {
        category?: { id: string; label: string };
        error?: string;
      };
      if (!res.ok || !json.category) throw new Error(json.error ?? "Could not add category");
      const opt = json.category;
      setOpts((p) =>
        p.some((o) => o.id === opt.id)
          ? p
          : [...p, opt].sort((a, b) => a.label.localeCompare(b.label)),
      );
      setSelected(opt.id);
      setName("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add category");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        name="category_id"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={field}
      >
        <option value="">—</option>
        {opts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
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
            placeholder="New category name"
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
          + Add category
        </button>
      )}
      {error ? <p className="mt-1 text-[12px] text-ink-body">{error}</p> : null}
    </div>
  );
}
