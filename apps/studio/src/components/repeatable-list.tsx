"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { serialiseLines } from "@/lib/lines";

/**
 * A small editable list of free-text lines that serialises to a single hidden
 * input (JSON array of strings), so it round-trips through the autosave form
 * exactly like an ordinary field. Empty lines are dropped on serialise.
 *
 * The hidden input is controlled by the rows (value={json}). It used to carry
 * defaultValue and have its value written by hand; for a hidden input the
 * value IS the default value, so every re-render put the initial list back
 * and the form never posted an added, changed or removed line.
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
  // Seeded once: a re-render of the page mid-edit must not reset the rows.
  const [rows, setRows] = useState<string[]>(() => (initial.length ? initial : []));
  const hidden = useRef<HTMLInputElement>(null);
  const json = serialiseLines(rows);

  // Tell a wrapping autosave form once the posted value has changed. Add and
  // Remove clicks fire no input event of their own, and a controlled hidden
  // input's new value fires none either. Keyed on the JSON itself (not a
  // skip-the-first-run flag), so StrictMode's double effect sends nothing.
  const lastJson = useRef(json);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (lastJson.current === json) return;
    lastJson.current = json;
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
    onChangeRef.current?.();
  }, [json]);

  const update = (i: number, val: string) => setRows((cur) => cur.map((r, idx) => (idx === i ? val : r)));
  const remove = (i: number) => setRows((cur) => cur.filter((_, idx) => idx !== i));
  const add = () => setRows((cur) => [...cur, ""]);

  return (
    <div>
      <input ref={hidden} type="hidden" name={name} value={json} readOnly />
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
