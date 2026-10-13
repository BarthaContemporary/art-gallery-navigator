"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";

type Option = { id: string; label: string };

/**
 * Category picker: a dropdown of existing categories with an inline
 * "add category" affordance. New categories are created in the DB and
 * selected immediately. Submits the chosen id as `category_id`.
 */
export function CategorySelect({
  id,
  options,
  defaultId,
}: {
  /** For the select, so the form's "Category" label names it. */
  id?: string;
  options: Option[];
  defaultId?: string | null;
}) {
  const [opts, setOpts] = useState<Option[]>(options);
  const [selected, setSelected] = useState(defaultId ?? "");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Choosing from the dropdown fires a real change event, but selecting a
  // freshly added category is a React state write — silent to the wrapping
  // autosave form. Nudge it whenever the selection changes; a duplicate nudge
  // after a genuine pick just lands in the same debounce window.
  const selectRef = useRef<HTMLSelectElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    selectRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [selected]);

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
        ref={selectRef}
        id={id}
        name="category_id"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="field"
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
            aria-label="New category name"
            placeholder="New category name"
            className="field field-sm min-w-0 flex-1"
          />
          <Button size="sm" onClick={() => void add()} pending={busy} pendingLabel="Adding…">
            Add
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setAdding(false);
              setName("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="link mt-1.5 inline-flex items-center gap-1 text-[12px]"
        >
          <PlusIcon size={14} />
          Add category
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
