/**
 * CSV cells for the studio's exports (contacts, inventory, stock book), safe
 * to open in a spreadsheet. Every CSV export writes its cells through here,
 * so the guard below cannot drift apart between them again.
 *
 * Self-contained on purpose (no imports): node --test runs it directly.
 */

/**
 * Characters that make a spreadsheet read a cell as a formula when they come
 * first (= + - @), plus the tab and line breaks that some readers skip before
 * looking at the first character.
 */
const FORMULA_START = /^[=+\-@\t\r\n]/;

/**
 * Characters that need the cell quoted: the quote itself, the separator,
 * line breaks, and the semicolon and tab that spreadsheets set up for other
 * locales or tab-separated imports read as separators.
 */
const NEEDS_QUOTES = /[",;\t\r\n]/;

/**
 * One cell. Text a spreadsheet would run as a formula gets an apostrophe in
 * front, which shows it as text. Numbers are left as they are: they come
 * from numeric columns and cannot carry a formula, and the apostrophe turned
 * a loss of -150 in the stock book into text that SUM skips.
 *
 * Line breaks inside a value become plain LF and the cell is quoted. A bare
 * CR used to go out unquoted, and readers that end a row on a CR then
 * started a new row in the middle of the value, whose first cell was a
 * formula nothing had guarded (an enquiry's address could carry one).
 */
export function csvCell(v: unknown): string {
  if (v == null) return "";
  if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "bigint" || typeof v === "boolean") {
    return String(v);
  }
  let s = String(v).replace(/\r\n?/g, "\n");
  if (FORMULA_START.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row: the cells of `values`, comma-separated. */
export function csvLine(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}
