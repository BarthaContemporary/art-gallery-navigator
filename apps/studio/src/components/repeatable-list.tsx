"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";

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
  itemLabel = "Line",
  onChange,
}: {
  name: string;
  initial: string[];
  placeholder?: string;
  addLabel?: string;
  /** Names each line for assistive technology: "Publication 2". */
  itemLabel?: string;
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
                aria-label={`${itemLabel} ${i + 1}`}
                onChange={(e) => update(i, e.target.value)}
                className="field"
              />
              <Button iconOnly label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`} onClick={() => remove(i)}>
                <CloseIcon size={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13px] text-meta">None yet.</p>
      )}
      <Button size="sm" icon={<PlusIcon size={14} />} onClick={add} className="mt-2">
        {addLabel}
      </Button>
    </div>
  );
}
