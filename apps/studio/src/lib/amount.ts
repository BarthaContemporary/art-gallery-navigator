import type { ClipboardEvent } from "react";

/**
 * Numbers as people paste them — "1,200", "£1,200.50", "1 200", "12,500 GBP"
 * — into what a numeric field and the database accept. Commas are thousands
 * separators (UK usage); the dot is the decimal point. Anything else is null.
 */
export function normaliseAmount(raw: string): string {
  const cleaned = raw
    .replace(/[ \s]/g, "") // spaces, non-breaking spaces (French-style 1 200)
    .replace(/[£$€]|GBP|USD|EUR|JPY|CHF/gi, "")
    .replace(/,/g, "")
    .replace(/[^0-9.+-]/g, "");
  return cleaned;
}

export function parseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = normaliseAmount(String(raw));
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * onPaste for `<input type="number">`: browsers refuse a pasted "1,200"
 * (the field stays empty), so take the clipboard text, strip the formatting
 * and write the plain number through the native setter, which fires the
 * normal input/change events for controlled and uncontrolled fields alike.
 */
export function cleanNumberPaste(e: ClipboardEvent<HTMLInputElement>) {
  const text = e.clipboardData.getData("text");
  if (!text) return;
  const cleaned = normaliseAmount(text);
  if (cleaned === text) return; // nothing to fix; let the browser paste
  e.preventDefault();
  const input = e.currentTarget;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) return;
  setter.call(input, cleaned);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
