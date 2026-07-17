"use client";

import { useCallback, useRef, useState } from "react";

const field =
  "w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";

/**
 * A small editable list of free-text lines that serialises to a single hidden
 * input (JSON array of strings), so it round-trips through the autosave form
 * exactly like an ordinary field. Empty lines are dropped on serialise.
 */
export function RepeatableList({
  name,
  initial,
  placeholder,
  addLabel = "Add",
  onChange,
}: {
  name: string;
  initial: string[];
  placeholder?: string;
  addLabel?: string;
  onChange?: () => void;
}) {
  const [rows, setRows] = useState<string[]>(initial.length ? initial : []);
  const hidden = useRef<HTMLInputElement>(null);

  const commit = useCallback(
    (next: string[]) => {
      setRows(next);
      if (hidden.current) {
        hidden.current.value = JSON.stringify(next.map((r) => r.trim()).filter(Boolean));
        // Notify any wrapping autosave form (covers add/remove clicks, which
        // don't otherwise fire an input event on the form).
        hidden.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
      onChange?.();
    },
    [onChange],
  );

  const update = (i: number, val: string) =>
    commit(rows.map((r, idx) => (idx === i ? val : r)));
  const remove = (i: number) => commit(rows.filter((_, idx) => idx !== i));
  const add = () => commit([...rows, ""]);

  return (
    <div>
      <input
        ref={hidden}
        type="hidden"
        name={name}
        defaultValue={JSON.stringify(initial)}
      />
      {rows.length ? (
        <ul className="mt-1.5 space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={row}
                placeholder={placeholder}
                onChange={(e) => update(i, e.target.value)}
                className={field}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                className="shrink-0 rounded-lg border border-line-control px-2.5 py-2 text-[13px] text-ink-soft hover:text-oranje"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[12.5px] text-ink-muted">None yet.</p>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-lg border border-line-control px-3 py-1.5 text-[12.5px] font-medium text-ink-body hover:border-line"
      >
        + {addLabel}
      </button>
    </div>
  );
}
