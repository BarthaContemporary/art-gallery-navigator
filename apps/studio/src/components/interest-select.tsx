"use client";

import { useState } from "react";

type Area = { id: string; name: string };

const labelCls =
  "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";

/**
 * Multi-select of "areas of interest" for a contact. Options come from the
 * shared master list (crm_interest_areas); the selection is written to the
 * form as a JSON hidden input (custom_fields.interests). Staff can add a new
 * area inline, which creates it in the master list and selects it.
 */
export function InterestSelect({
  options: initialOptions,
  selected: initialSelected,
  onChange,
}: {
  options: Area[];
  selected: string[];
  onChange?: () => void;
}) {
  const [options, setOptions] = useState<Area[]>(initialOptions);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    onChange?.();
  };

  async function addNew() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/crm/interests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { area?: Area };
      if (data.area) {
        const area = data.area;
        setOptions((prev) => (prev.some((o) => o.id === area.id) ? prev : [...prev, area]));
        setSelected((prev) => (prev.includes(area.name) ? prev : [...prev, area.name]));
        setNewName("");
        onChange?.();
      }
    } catch {
      /* ignore */
    }
    setAdding(false);
  }

  return (
    <div className="sm:col-span-2">
      <span className={labelCls}>Areas of interest</span>
      <input type="hidden" name="interests" value={JSON.stringify(selected)} />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.name);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.name)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                on
                  ? "border-oranje bg-oranje/10 text-oranje"
                  : "border-line-control text-ink-mid hover:text-ink-strong"
              }`}
            >
              {o.name}
            </button>
          );
        })}
        {options.length === 0 ? (
          <span className="text-[12px] text-ink-muted">No areas yet — add one below.</span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addNew();
            }
          }}
          placeholder="Add a new area of interest…"
          className="w-64 rounded-lg border border-line-control bg-control px-3 py-1.5 text-[13px] text-ink-body"
        />
        <button
          type="button"
          onClick={addNew}
          disabled={adding || !newName.trim()}
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
