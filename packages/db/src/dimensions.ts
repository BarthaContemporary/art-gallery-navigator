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
  /**
   * For a framed work the default columns above ARE the framed size — what
   * hangs, ships and appears in the catalogue — and the unframed columns
   * record the work itself.
   */
  framed?: boolean | null;
  unframed_height_cm?: number | string | null;
  unframed_width_cm?: number | string | null;
  unframed_depth_cm?: number | string | null;
  unframed_length_cm?: number | string | null;
  unframed_diameter_cm?: number | string | null;
};

const PARTS: [keyof PieceDimensions, string][] = [
  ["height_cm", "H"],
  ["width_cm", "W"],
  ["depth_cm", "D"],
  ["length_cm", "L"],
  ["diameter_cm", "Ø"],
];

/** The columns to request when a query only needs to print dimensions. */
export const DIMENSION_COLUMNS =
  "height_cm, width_cm, depth_cm, length_cm, diameter_cm, framed, " +
  "unframed_height_cm, unframed_width_cm, unframed_depth_cm, unframed_length_cm, unframed_diameter_cm";

/** The unframed measurements mapped onto the default keys, for the formatter. */
export function unframedDimensions(dims: PieceDimensions): PieceDimensions {
  return {
    height_cm: dims.unframed_height_cm,
    width_cm: dims.unframed_width_cm,
    depth_cm: dims.unframed_depth_cm,
    length_cm: dims.unframed_length_cm,
    diameter_cm: dims.unframed_diameter_cm,
  };
}

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

/**
 * The full catalogue line, framed and unframed together:
 *
 *   unframed work —  "H 17 × W 16.5 cm"
 *   framed work   —  "H 40 × W 30 cm (framed) · H 28 × W 18 cm (unframed)"
 *
 * The default columns are always the size that governs — the framed size for
 * a framed work — so a surface that prints only formatDimensionsCm() is never
 * wrong, just less complete. Use this wherever dimensions are displayed or
 * exported in full: fact sheets, certificates, offer documents, the website.
 */
export function formatDimensionsFullCm(dims: PieceDimensions): string | null {
  const main = formatDimensionsCm(dims);
  if (!dims.framed) return main;
  const unframed = formatDimensionsCm(unframedDimensions(dims));
  if (main && unframed) return `${main} (framed) · ${unframed} (unframed)`;
  if (main) return `${main} (framed)`;
  if (unframed) return `${unframed} (unframed)`;
  return null;
}
