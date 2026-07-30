/*
 * One way to render a work's dimensions, shared by the studio, the public site
 * and every generated document.
 *
 * These used to be printed from `pieces.dimensions_display` — a verbatim string
 * the FileMaker import wrote by keeping the *first* dimension-looking snippet it
 * found in the old free-text field. That made it strictly worse than the parsed
 * numerics: a work measured H 17 × W 16.5 cm carried the string "17cm", and
 * that truncated string is what certificates, fact sheets, the offer pages and
 * the website printed. The column is retired; dimensions come from the numeric
 * cm fields now, which are the fields the dealer actually edits.
 */

/** Accepts the numeric columns as PostgREST returns them (number, or string). */
export type PieceDimensions = {
  height_cm?: number | string | null;
  width_cm?: number | string | null;
  depth_cm?: number | string | null;
  length_cm?: number | string | null;
  diameter_cm?: number | string | null;
};

const PARTS: [keyof PieceDimensions, string][] = [
  ["height_cm", "H"],
  ["width_cm", "W"],
  ["depth_cm", "D"],
  ["length_cm", "L"],
  ["diameter_cm", "Ø"],
];

/** The columns to request when a query only needs to print dimensions. */
export const DIMENSION_COLUMNS = "height_cm, width_cm, depth_cm, length_cm, diameter_cm";

/**
 * "H 17 × W 16.5 cm", or null when nothing is measured.
 *
 * Null rather than a dash so each surface picks its own empty state — the
 * studio shows "—", the website and the documents omit the line entirely.
 */
export function formatDimensionsCm(dims: PieceDimensions): string | null {
  const parts: string[] = [];
  for (const [key, prefix] of PARTS) {
    const raw = dims[key];
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n === "number" && Number.isFinite(n) && n !== 0) parts.push(`${prefix} ${n}`);
  }
  return parts.length > 0 ? `${parts.join(" × ")} cm` : null;
}
