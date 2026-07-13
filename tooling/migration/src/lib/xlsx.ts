import ExcelJS from "exceljs";
import type { RawRow } from "./columns.js";

/**
 * Normalize an exceljs cell value to a JSON-safe primitive.
 * Handles rich text, hyperlinks, formula results, shared formulas and dates.
 */
export function normalizeCellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o["richText"])) {
      return (o["richText"] as Array<{ text?: string }>)
        .map((r) => r.text ?? "")
        .join("");
    }
    if ("hyperlink" in o || "text" in o) {
      return normalizeCellValue(o["text"] as ExcelJS.CellValue);
    }
    if ("formula" in o || "sharedFormula" in o) {
      return normalizeCellValue(o["result"] as ExcelJS.CellValue);
    }
    if ("error" in o) return null;
    return null;
  }
  return v;
}

export interface ParsedWorkbook {
  headers: string[];
  rows: RawRow[];
}

/**
 * Read the first worksheet of an xlsx file into an array of row objects
 * keyed by the exact header text of row 1, preserving sheet row numbers.
 * Fully empty rows are skipped.
 */
export async function readWorkbook(filePath: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`No worksheet found in ${filePath}`);

  const headersByCol = new Map<number, string>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = String(normalizeCellValue(cell.value) ?? "").trim();
    if (header) headersByCol.set(colNumber, header);
  });

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: Record<string, unknown> = {};
    let hasAny = false;
    for (const [colNumber, header] of headersByCol) {
      const value = normalizeCellValue(row.getCell(colNumber).value);
      const cleaned = typeof value === "string" ? value : value;
      if (cleaned !== null && cleaned !== "" && String(cleaned).trim() !== "") {
        hasAny = true;
      }
      data[header] = cleaned === "" ? null : cleaned;
    }
    if (hasAny) rows.push({ row_number: rowNumber, data });
  });

  return { headers: [...headersByCol.values()], rows };
}

/** Per-column fill rate: fraction of rows with a non-empty value. */
export function fillRates(
  headers: string[],
  rows: RawRow[],
): Array<{ column: string; filled: number; rate: number }> {
  return headers.map((column) => {
    const filled = rows.filter((r) => {
      const v = r.data[column];
      return v !== null && v !== undefined && String(v).trim() !== "";
    }).length;
    return { column, filled, rate: rows.length ? filled / rows.length : 0 };
  });
}
