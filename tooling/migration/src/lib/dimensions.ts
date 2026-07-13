import { COL } from "./columns.js";
import { toText } from "./values.js";

/** Sanity bounds for a plausible dimension in cm. */
export const MIN_CM = 0.1;
export const MAX_CM = 500;

export const IN_TO_CM = 2.54;

export interface DimensionIssue {
  field: string;
  issue: string;
  raw_value: string;
}

export interface ParsedDimensions {
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  length_cm: number | null;
  diameter_cm: number | null;
  dimensions_display: string | null;
  issues: DimensionIssue[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function inBounds(cm: number): boolean {
  return cm >= MIN_CM && cm <= MAX_CM;
}

/**
 * Parse a single dimension cell that may be a number or a string like
 * '15.5cm', '15.5 cm', '5 3/4 in', '6"'. Returns a value in cm, or null.
 * `defaultUnit` applies when the value carries no unit of its own.
 */
export function parseDimensionValue(
  v: unknown,
  defaultUnit: "cm" | "in",
): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return defaultUnit === "in" ? v * IN_TO_CM : v;
  }
  const s = toText(v);
  if (!s) return null;
  const m = s.replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(cm|in\b|inch(?:es)?|"|”)?\.?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2]
    ? /cm/i.test(m[2])
      ? "cm"
      : "in"
    : defaultUnit;
  return unit === "in" ? n * IN_TO_CM : n;
}

/** True when a piece of text looks like it describes dimensions. */
export function looksLikeDimensionText(s: string): boolean {
  return (
    /\d\s*(?:cm\b|mm\b|in\b|inch|["”]|¾|½|¼)/i.test(s) ||
    /\b(height|width|depth|length|diameter|diam\.?)\s*:?\s*\d/i.test(s) ||
    /Ø\s*\d/.test(s)
  );
}

type DimKey = "height_cm" | "width_cm" | "depth_cm" | "length_cm" | "diameter_cm";

const DESCRIPTION_WORD_PATTERNS: Array<[DimKey, RegExp]> = [
  ["height_cm", /\bheight\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i],
  ["width_cm", /\bwidth\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i],
  ["depth_cm", /\bdepth\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i],
  ["length_cm", /\blength\s*:?\s*(\d+(?:[.,]\d+)?)\s*cm/i],
  ["diameter_cm", /(?:\bdiam(?:eter)?\.?\s*:?|Ø)\s*(\d+(?:[.,]\d+)?)\s*cm/i],
];

const LETTER_TO_KEY: Record<string, DimKey> = {
  H: "height_cm",
  W: "width_cm",
  D: "depth_cm",
  L: "length_cm",
};

/**
 * Extract dimensions from free text (Description), e.g.
 *   'Height: 15.5 cm, 5 ¾ in'
 *   'H: 23.5 x W: 22 cm'
 *   'Ø 12 cm'
 * Returns cm values (bounds-checked by the caller) plus the verbatim
 * first dimension-looking snippet for dimensions_display.
 */
export function parseDimensionsFromText(text: string): {
  values: Partial<Record<DimKey, number>>;
  display: string | null;
} {
  const values: Partial<Record<DimKey, number>> = {};
  let display: string | null = null;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !looksLikeDimensionText(line)) continue;
    if (!display) display = line;

    for (const [key, re] of DESCRIPTION_WORD_PATTERNS) {
      const m = line.match(re);
      if (m && values[key] === undefined) {
        values[key] = Number(m[1]!.replace(",", "."));
      }
    }

    // Compact form: 'H: 23.5 x W: 22 cm' / 'H 23.5 × W 22 × D 4 cm'
    if (/\bcm\b/i.test(line)) {
      const compact = line.matchAll(/\b([HWDL])\s*:?\s*(\d+(?:[.,]\d+)?)/g);
      for (const m of compact) {
        const key = LETTER_TO_KEY[m[1]!.toUpperCase()];
        if (key && values[key] === undefined) {
          values[key] = Number(m[2]!.replace(",", "."));
        }
      }
    }
  }
  return { values, display };
}

/**
 * Full dimension resolution for one row:
 * 1. numeric cm columns (sanity-bounded),
 * 2. numeric inch columns × 2.54,
 * 3. strings like '15.5cm' in any of the 8 columns,
 * 4. regex over the Description free text.
 * dimensions_display keeps the first verbatim dimension-looking text found.
 */
export function resolveDimensions(data: Record<string, unknown>): ParsedDimensions {
  const issues: DimensionIssue[] = [];
  const out: ParsedDimensions = {
    height_cm: null,
    width_cm: null,
    depth_cm: null,
    length_cm: null,
    diameter_cm: null,
    dimensions_display: null,
    issues,
  };

  // Column preference order per dimension: cm column first, then inch column.
  const columnPlan: Array<{ key: DimKey; column: string; unit: "cm" | "in" }> = [
    { key: "height_cm", column: COL.hInCm, unit: "cm" },
    { key: "height_cm", column: COL.hIn, unit: "in" },
    { key: "height_cm", column: COL.inches, unit: "in" },
    { key: "width_cm", column: COL.wInCm, unit: "cm" },
    { key: "length_cm", column: COL.lInCm, unit: "cm" },
    { key: "length_cm", column: COL.lInIn, unit: "in" },
    { key: "depth_cm", column: COL.dInCm, unit: "cm" },
    { key: "depth_cm", column: COL.dInIn, unit: "in" },
  ];

  for (const { key, column, unit } of columnPlan) {
    const raw = data[column];
    const text = toText(raw);
    if (text === null) continue;

    // Remember the first verbatim dimension-looking string cell.
    if (
      out.dimensions_display === null &&
      typeof raw === "string" &&
      looksLikeDimensionText(text)
    ) {
      out.dimensions_display = text;
    }

    if (out[key] !== null) continue;
    const cm = parseDimensionValue(raw, unit);
    if (cm === null) {
      issues.push({ field: column, issue: "dimension_parse_failed", raw_value: text });
      continue;
    }
    if (!inBounds(cm)) {
      issues.push({ field: column, issue: "dimension_out_of_bounds", raw_value: text });
      continue;
    }
    out[key] = round1(cm);
  }

  // Fallback: regex over Description for anything still missing.
  const description = toText(data[COL.description]);
  if (description) {
    const { values, display } = parseDimensionsFromText(description);
    let usedDescription = false;
    for (const [key, cm] of Object.entries(values) as Array<[DimKey, number]>) {
      if (out[key] !== null) continue;
      if (!inBounds(cm)) {
        issues.push({
          field: COL.description,
          issue: "dimension_out_of_bounds",
          raw_value: `${key}=${cm}`,
        });
        continue;
      }
      out[key] = round1(cm);
      usedDescription = true;
    }
    if (usedDescription) {
      issues.push({
        field: COL.description,
        issue: "dimension_from_description",
        raw_value: display ?? "",
      });
    }
    if (out.dimensions_display === null && display) {
      out.dimensions_display = display;
    }
  }

  return out;
}
