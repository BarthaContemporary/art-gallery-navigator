/** Small pure coercion helpers shared by all cleaning passes. */

/** Trimmed string, or null when the cell is empty/absent. */
export function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/**
 * Lenient numeric coercion: accepts numbers and numeric-looking strings,
 * stripping currency symbols and thousands separators. Returns null when
 * the value is not usable as a number.
 */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/[£¥€$,\s]/g, "");
  if (s === "" || !/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** True when the cell has any non-empty content. */
export function hasValue(v: unknown): boolean {
  return toText(v) !== null;
}

/** ISO date string (YYYY-MM-DD) from a Date / ISO string / dd/mm/yyyy string, else null. */
export function toIsoDate(v: unknown): string | null {
  const s = toText(v);
  if (!s) return null;
  // exceljs dates are serialized to ISO strings in raw.json
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/** Year (number) from a date-ish value, else null. */
export function toYear(v: unknown): number | null {
  const iso = toIsoDate(v);
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return y >= 1900 && y <= 2100 ? y : null;
}
