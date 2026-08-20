"use client";

import { useState } from "react";
import { cmToInchesFraction, gramsToPounds } from "@/lib/measure";

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";

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

  const input = (k: string) => (
    <>
      <input
        name={k}
        type="number"
        step="0.1"
        value={vals[k]}
        onChange={(e) => set(k, e.target.value)}
        className={field}
      />
      <span className="mt-1 block h-[14px] font-mono text-[11px] text-ink-soft">
        {preview(k) ?? ""}
      </span>
    </>
  );

  return (
    <div>
      <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {DIMS.map(([k, plain, whenFramed]) => (
          <label key={k} className={label}>
            {framed ? whenFramed : plain}
            {input(k)}
          </label>
        ))}
      </div>

      {/* A real form input, so ticking it autosaves like any other field.
          Unticking hides the unframed row; its fields leave the form entirely
          and the server clears the stored unframed measurements. */}
      <label className="mt-4 flex items-center gap-2 text-[12.5px] font-medium text-ink-body">
        <input
          type="checkbox"
          name="framed"
          checked={framed}
          onChange={(e) => setFramed(e.target.checked)}
          className="h-4 w-4 accent-[var(--jvb-bg-primary)]"
        />
        Framed
        {framed ? (
          <span className="font-normal text-[11.5px] text-ink-soft">
            — sizes in cm (weight g); the row above is the framed size, record the unframed work below
          </span>
        ) : null}
      </label>

      {framed ? (
        <div className="mt-2 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {UNFRAMED_DIMS.map(([k, lab]) => (
            <label key={k} className={label}>
              {lab}
              {input(k)}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
