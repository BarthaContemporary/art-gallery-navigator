"use client";

import { useId, useState } from "react";
import { ToggleChip } from "./ui/chips";
import { Button } from "./ui/button";
import { PlusIcon } from "./ui/icons";

type Area = { id: string; name: string };

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
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const newId = useId();

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    onChange?.();
  };

  const allSelected = options.length > 0 && options.every((o) => selected.includes(o.name));
  const selectAll = () => {
    setSelected(allSelected ? [] : options.map((o) => o.name));
    onChange?.();
  };

  async function addNew() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/interests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as { area?: Area; error?: string };
      if (!res.ok || !data.area) {
        throw new Error(data.error ?? `Could not add (HTTP ${res.status})`);
      }
      const area = data.area;
      setOptions((prev) => (prev.some((o) => o.id === area.id) ? prev : [...prev, area]));
      setSelected((prev) => (prev.includes(area.name) ? prev : [...prev, area.name]));
      setNewName("");
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div role="group" aria-labelledby={headingId} className="sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="label">
          Areas of interest
        </h3>
        {options.length > 0 ? (
          <Button variant="quiet" size="sm" onClick={selectAll}>
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        ) : null}
      </div>
      <input type="hidden" name="interests" value={JSON.stringify(selected)} />
      {/* Pressed is an ink fill (the shared chip), not a tint of orange. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <ToggleChip key={o.id} pressed={selected.includes(o.name)} onClick={() => toggle(o.name)}>
            {o.name}
          </ToggleChip>
        ))}
        {options.length === 0 ? (
          <span className="text-[13px] leading-[1.45] text-body">No areas yet. Add one below.</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-64">
          <label htmlFor={newId} className="label">
            New area of interest
          </label>
          <input
            id={newId}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addNew();
              }
            }}
            placeholder="Chinese export porcelain"
            className="field"
          />
        </div>
        <Button
          onClick={addNew}
          disabled={!newName.trim()}
          pending={adding}
          pendingLabel="Adding…"
          icon={<PlusIcon size={14} />}
        >
          Add
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] leading-[1.4] text-danger">
          Couldn’t add: {error}
        </p>
      ) : null}
    </div>
  );
}
