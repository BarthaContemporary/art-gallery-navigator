import type { RawRow } from "./columns.js";
import { COL } from "./columns.js";
import { toText } from "./values.js";

/**
 * Normalize a legacy stock number to a trimmed string.
 * Numeric cells arrive as numbers (or '123.0' strings) — integers keep
 * no decimal part. Returns null for blank cells.
 */
export function normalizeStockNumber(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isInteger(v) ? String(v) : String(v);
  }
  const s = toText(v);
  if (!s) return null;
  return s.replace(/\.0$/, "");
}

export interface StockStats {
  total: number;
  blank: number;
  duplicateValues: Map<string, number[]>; // stock number -> row_numbers
}

/** Dataset-level stock number statistics (blanks + duplicates with row numbers). */
export function stockStats(rows: RawRow[]): StockStats {
  const byValue = new Map<string, number[]>();
  let blank = 0;
  for (const row of rows) {
    const sn = normalizeStockNumber(row.data[COL.stockNumber]);
    if (sn === null) {
      blank += 1;
      continue;
    }
    const list = byValue.get(sn) ?? [];
    list.push(row.row_number);
    byValue.set(sn, list);
  }
  const duplicateValues = new Map(
    [...byValue].filter(([, rowNumbers]) => rowNumbers.length > 1),
  );
  return { total: rows.length, blank, duplicateValues };
}
