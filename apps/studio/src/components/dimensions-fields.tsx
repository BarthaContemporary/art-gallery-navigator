"use client";

import { useState } from "react";
import { cmToInchesFraction, gramsToPounds } from "@/lib/measure";

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";

const DIMS = [
  ["height_cm", "Height cm"],
  ["width_cm", "Width cm"],
  ["depth_cm", "Depth cm"],
  ["length_cm", "Length cm"],
  ["diameter_cm", "Diameter cm"],
  ["weight_g", "Weight g"],
] as const;

// The frame mirrors the work's own measurement row, F.-prefixed.
const FRAME_DIMS = [
  ["frame_height_cm", "F. Height cm"],
  ["frame_width_cm", "F. Width cm"],
  ["frame_depth_cm", "F. Depth cm"],
  ["frame_length_cm", "F. Length cm"],
  ["frame_diameter_cm", "F. Diameter cm"],
  ["frame_weight_g", "F. Weight g"],
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
    for (const [k] of [...DIMS, ...FRAME_DIMS]) init[k] = defaults[k] ?? "";
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

  const row = (dims: typeof DIMS | typeof FRAME_DIMS) => (
    <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
      {dims.map(([k, lab]) => (
        <label key={k} className={label}>
          {lab}
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
        </label>
      ))}
    </div>
  );

  return (
    <div>
      {row(DIMS)}

      {/* The checkbox is a real form input, so ticking it autosaves like any
          other field. Unticking hides the frame row; its fields then leave the
          form entirely and the server clears the stored frame dimensions —
          an unframed work must not keep phantom frame measurements. */}
      <label className="mt-4 flex items-center gap-2 text-[12.5px] font-medium text-ink-body">
        <input
          type="checkbox"
          name="framed"
          checked={framed}
          onChange={(e) => setFramed(e.target.checked)}
          className="h-4 w-4 accent-[var(--jvb-bg-primary)]"
        />
        Framed
      </label>

      {framed ? row(FRAME_DIMS) : null}
    </div>
  );
}
