"use client";

import { useState } from "react";
import { cleanNumberPaste } from "@/lib/amount";
import { cmToInchesFraction, gramsToPounds } from "@/lib/measure";


// The default dimensions. For a framed work these ARE the framed size — what
// hangs, ships and appears in the catalogue — so the labels say so while the
// checkbox is ticked.
// The framed-mode labels drop the unit so the F./U. prefixes don't push them
// over one line; everything is still centimetres (grams for weight), and the
// inches preview under each field keeps saying so.
const DIMS = [
  ["height_cm", "Height cm", "F. Height"],
  ["width_cm", "Width cm", "F. Width"],
  ["depth_cm", "Depth cm", "F. Depth"],
  ["length_cm", "Length cm", "F. Length"],
  ["diameter_cm", "Diameter cm", "F. Diameter"],
  ["weight_g", "Weight g", "F. Weight"],
] as const;

// The unframed work itself, recorded alongside the framed size.
const UNFRAMED_DIMS = [
  ["unframed_height_cm", "U. Height"],
  ["unframed_width_cm", "U. Width"],
  ["unframed_depth_cm", "U. Depth"],
  ["unframed_length_cm", "U. Length"],
  ["unframed_diameter_cm", "U. Diameter"],
  ["unframed_weight_g", "U. Weight"],
] as const;

/** Dimension inputs with a live imperial preview under each (inches; lb for weight). */
export function DimensionsFields({
  defaults,
  framed: framedDefault = false,
}: {
  defaults: Record<string, string>;
  framed?: boolean;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [k] of DIMS) init[k] = defaults[k] ?? "";
    for (const [k] of UNFRAMED_DIMS) init[k] = defaults[k] ?? "";
    return init;
  });
  const [framed, setFramed] = useState(framedDefault);
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const preview = (k: string): string | null => {
    const raw = vals[k];
    const n = Number(raw);
    if (!raw || Number.isNaN(n) || n === 0) return null;
    return k.endsWith("_g") ? `${gramsToPounds(n)} lb` : `${cmToInchesFraction(n)} in`;
  };

  // One measurement: its label above, the field, and the imperial figure
  // under it (announced with the field through aria-describedby).
  const input = (k: string) => (
    <>
      <input
        id={`dim-${k}`}
        name={k}
        type="number" onPaste={cleanNumberPaste}
        step="0.1"
        value={vals[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-describedby={`dim-${k}-imperial`}
        className="field tabular"
      />
      <span id={`dim-${k}-imperial`} className="tabular block h-[16px] text-[12px] leading-[1.4] text-meta">
        {preview(k) ?? ""}
      </span>
    </>
  );

  // Three across in the half-width column of a wide editor, six on a
  // full-width row.
  const grid = "grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-6 lg:grid-cols-3";

  return (
    <div>
      <div className={grid}>
        {DIMS.map(([k, plain, whenFramed]) => (
          <div key={k} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`dim-${k}`} className="label truncate">
              {framed ? whenFramed : plain}
            </label>
            {input(k)}
          </div>
        ))}
      </div>

      {/* A real form input, so ticking it autosaves like any other field.
          Unticking hides the unframed row; its fields leave the form entirely
          and the server clears the stored unframed measurements. */}
      <label className="mt-4 flex w-fit cursor-pointer items-start gap-2 text-[13px] leading-[1.45] text-ink">
        <input
          type="checkbox"
          name="framed"
          checked={framed}
          onChange={(e) => setFramed(e.target.checked)}
          className="mt-[2px] h-4 w-4 shrink-0"
        />
        <span>
          Framed
          {framed ? (
            <span className="block text-[12px] leading-[1.4] text-meta">
              Sizes in cm (weight in g). The row above is the framed size; record the unframed work below.
            </span>
          ) : null}
        </span>
      </label>

      {framed ? (
        <div className={`mt-3 ${grid}`}>
          {UNFRAMED_DIMS.map(([k, lab]) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`dim-${k}`} className="label truncate">
                {lab}
              </label>
              {input(k)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
