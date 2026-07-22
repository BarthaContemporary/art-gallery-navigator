import type ExcelJS from "exceljs";

/**
 * Shared helpers so the XLSX exports open cleanly and legibly in Numbers (and
 * Excel): friendly headers, real date cells, currency/percent number formats, a
 * frozen + filtered header row.
 */

const HEADER_OVERRIDES: Record<string, string> = {
  stock_number: "Stock no.",
  legacy_stock_number: "Legacy stock no.",
  vat_treatment: "VAT treatment",
  vat_due_gbp: "VAT due £",
  jvb_share_gbp: "J.v.d.B. share £",
  reclaimable_import_vat_gbp: "Reclaimable import VAT £",
  import_vat_gbp: "Import VAT £",
  consignment_share_pct: "Consignment share %",
  sale_handled_by_jvb: "Sale handled by J.v.d.B.",
  maker_name: "Maker",
  category_name: "Category",
  location_code: "Location",
  do_not_mail: "Do not mail",
  email: "Email",
};

/** snake_case view column → a human header. */
export function prettyHeader(key: string): string {
  if (HEADER_OVERRIDES[key]) return HEADER_OVERRIDES[key];
  const h = key
    .replace(/_gbp$/i, " £")
    .replace(/_pct$/i, " %")
    .replace(/_id$/i, "")
    .replace(/_/g, " ")
    .trim();
  return h.charAt(0).toUpperCase() + h.slice(1);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Coerce a raw value into the best cell type (real dates, Yes/No, £/number). */
export function cellValue(key: string, value: unknown): string | number | boolean | Date {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/_date$/i.test(key) && typeof value === "string" && DATE_RE.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return value as string | number;
}

/** Width heuristic per column so nothing is clipped and text columns are roomy. */
export function columnWidth(key: string): number {
  if (/description|title|address|notes|name/i.test(key)) return 40;
  if (/_gbp$|_pct$|_date$/i.test(key)) return 15;
  return 22;
}

/** Bold + frozen + auto-filtered header row, and number formats per column. */
export function styleSheet(ws: ExcelJS.Worksheet, keys: string[]): void {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  keys.forEach((k, i) => {
    const col = ws.getColumn(i + 1);
    if (/_gbp$/i.test(k)) col.numFmt = "£#,##0.00";
    else if (/_pct$/i.test(k)) col.numFmt = '0.0"%"';
    else if (/_date$/i.test(k)) col.numFmt = "dd/mm/yyyy";
  });
}
