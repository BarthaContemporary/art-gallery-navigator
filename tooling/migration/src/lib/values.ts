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

/** YYYY-MM-DD when y/m/d is a real calendar date, else null. */
function isoIfValid(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/**
 * An Excel date serial (days since 30 December 1899) as YYYY-MM-DD, in UTC.
 * Only plausible serials (1920 to 2099) count; a small number in a date
 * column is junk, not a day in 1900.
 */
export function excelSerialToIso(n: number): string | null {
  if (!Number.isFinite(n) || n < 7306 || n >= 73051) return null;
  return new Date(Math.round((Math.floor(n) - 25569) * 86_400_000)).toISOString().slice(0, 10);
}

/**
 * ISO date string (YYYY-MM-DD), else null. Accepts ISO (what exceljs writes
 * for date cells into raw.json), British day-first d/m/yyyy and d/m/yy
 * (with / . or -; two-digit years 00–49 are 20xx, 50–99 are 19xx) and Excel
 * date serials. Nothing else: the old fallback to `new Date(text)` read
 * '05/03/19' month-first and shifted dates a day in British Summer Time.
 */
export function toIsoDate(v: unknown): string | null {
  if (typeof v === "number") return excelSerialToIso(v);
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = toText(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  if (iso) return isoIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (dmy[3]!.length === 2) y += y <= 49 ? 2000 : 1900;
    return isoIfValid(y, Number(dmy[2]), Number(dmy[1]));
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToIso(Number(s));
  return null;
}

/** Year (number) from a date-ish value, else null. */
export function toYear(v: unknown): number | null {
  const iso = toIsoDate(v);
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return y >= 1900 && y <= 2100 ? y : null;
}
