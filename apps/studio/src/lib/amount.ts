import type { ClipboardEvent } from "react";

/**
 * Numbers as people type and paste them — "1,200", "£1,200.50", "1 200",
 * "12,500 GBP", "12.5 cm" — into what a numeric field and the database
 * accept: a plain dot-decimal string ("1200.50"), or "" when there is no
 * plain number in it.
 *
 * Commas are thousands separators (UK usage) and the dot is the decimal
 * point, with the forms that cannot be read that way: a final comma followed
 * by one or two digits is a decimal comma ("1250,50", "1.200,50",
 * "12.500,00 €"), and dots grouping threes with no decimal part are
 * thousands ("1.200.000"). An exponent ("1e5"), a hex number ("0x10") or a
 * bracketed figure ("(150)") is not an amount and gives "".
 */
export function normaliseAmount(raw: string): string {
  const compact = raw
    .replace(/\s/g, "") // spaces, non-breaking and narrow spaces (French-style 1 200)
    .replace(/[£$€¥]|GBP|USD|EUR|JPY|CHF/gi, "");
  // Read as a different number before: 1e5 → 15, 0x10 → 10, (150) → 150,
  // 10x20 → 1020.
  if (/\d[eE][+-]?\d|0[xX][0-9a-fA-F]|\d[xX×*]\d|^\(.*\)$/.test(compact)) return "";
  const s = compact.replace(/[^0-9.,+-]/g, ""); // units and other words
  if (s === "") return "";

  let plain: string;
  const decimalComma = /^([+-]?)([\d.,]*\d),(\d{1,2})$/.exec(s);
  if (decimalComma && /^(\d+|\d{1,3}(\.\d{3})+|\d{1,3}(,\d{3})+)$/.test(decimalComma[2]!)) {
    const [, sign, whole, frac] = decimalComma;
    plain = `${sign}${whole!.replace(/[.,]/g, "")}.${frac}`;
  } else {
    plain = s.replace(/,/g, "");
    if (/^[+-]?\d{1,3}(\.\d{3}){2,}$/.test(plain)) plain = plain.replace(/\./g, "");
  }
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(plain) ? plain : "";
}

/**
 * An amount as typed: its value, null for an empty field, and `invalid` when
 * something was typed that is not an amount. A save leaves a stored figure
 * alone rather than clearing it for an invalid entry.
 */
export function readAmount(raw: unknown): { value: number | null; invalid: boolean } {
  if (raw == null) return { value: null, invalid: false };
  if (typeof raw === "number") return Number.isFinite(raw) ? { value: raw, invalid: false } : { value: null, invalid: true };
  const text = String(raw);
  if (text.trim() === "") return { value: null, invalid: false };
  const cleaned = normaliseAmount(text);
  const n = cleaned === "" ? NaN : Number(cleaned);
  return Number.isFinite(n) ? { value: n, invalid: false } : { value: null, invalid: true };
}

export function parseAmount(raw: unknown): number | null {
  return readAmount(raw).value;
}

/**
 * onPaste for `<input type="number">`: browsers refuse a pasted "1,200"
 * (the field stays empty), so take the clipboard text, strip the formatting
 * and write the plain number through the native setter, which fires the
 * normal input/change events for controlled and uncontrolled fields alike.
 * Text with no plain number in it is left to the browser.
 */
export function cleanNumberPaste(e: ClipboardEvent<HTMLInputElement>) {
  const text = e.clipboardData.getData("text");
  if (!text) return;
  const cleaned = normaliseAmount(text);
  if (cleaned === "" || cleaned === text) return; // nothing to fix, or nothing to keep
  e.preventDefault();
  const input = e.currentTarget;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) return;
  setter.call(input, cleaned);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
