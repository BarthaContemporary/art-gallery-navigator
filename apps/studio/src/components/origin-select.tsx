"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";

/**
 * Origin/region picker: a dropdown of curated regions with an inline
 * "add region" affordance. New regions are saved for reuse elsewhere.
 * Submits the chosen region name as `origin_region` (free text on pieces).
 */
export function OriginSelect({
  id,
  options,
  defaultValue,
}: {
  /** For the select, so the form's "Origin / region" label names it. */
  id?: string;
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

  // Selecting a freshly added region is a React state write, which emits no DOM
  // event for the wrapping autosave form to hear. See category-select.tsx.
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
        ref={selectRef}
        id={id}
        name="origin_region"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="field"
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
            aria-label="New region"
            placeholder="New region"
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
          Add region
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
