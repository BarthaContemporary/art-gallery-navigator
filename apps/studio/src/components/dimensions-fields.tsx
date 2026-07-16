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

/** Dimension inputs with a live imperial preview under each (inches; lb for weight). */
export function DimensionsFields({ defaults }: { defaults: Record<string, string> }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { dimensions_display: defaults.dimensions_display ?? "" };
    for (const [k] of DIMS) init[k] = defaults[k] ?? "";
    return init;
  });
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const preview = (k: string): string | null => {
    const raw = vals[k];
    const n = Number(raw);
    if (!raw || Number.isNaN(n) || n === 0) return null;
    return k === "weight_g" ? `${gramsToPounds(n)} lb` : `${cmToInchesFraction(n)} in`;
  };

  return (
    <div>
      <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {DIMS.map(([k, lab]) => (
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
      <label className={`${label} mt-3 block`}>
        Display fallback (verbatim)
        <input
          name="dimensions_display"
          value={vals.dimensions_display}
          onChange={(e) => set("dimensions_display", e.target.value)}
          className={field}
        />
      </label>
    </div>
  );
}
