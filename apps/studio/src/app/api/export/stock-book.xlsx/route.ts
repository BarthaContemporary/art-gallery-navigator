import { downloadResponse } from "@/lib/shared-drive";
import ExcelJS from "exceljs";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";
import { prettyHeader, cellValue, columnWidth, styleSheet } from "@/lib/xlsx-clean";
import { selectAllRows } from "@/lib/paged-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Margin-scheme stock book export for the accountant (HMRC VAT Notice 718).
 * Always a plain download: the file holds costs, margins and sellers, and the
 * shared drive would hand it to every staff member (see shared-drive.ts).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles)) {
    return new Response("Forbidden", { status: 403 });
  }
  const supabase = await getSupabase();
  const url = new URL(request.url);
  const s = url.searchParams.get("scheme") ?? "";
  const scheme = ["margin", "standard", "zero_rated", "outside_scope"].includes(s) ? s : "all";
  const view =
    scheme === "standard"
      ? "vw_stock_book_standard"
      : scheme === "zero_rated"
        ? "vw_stock_book_zero_rated"
        : scheme === "outside_scope"
          ? "vw_stock_book_outside_scope"
          : scheme === "margin"
            ? "vw_stock_book"
            : "vw_stock_book_all";

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let rows: Record<string, unknown>[];
  try {
    // Paged, as the CSV: the stock book must never stop at an API row cap
    // without saying so. piece_id breaks ties on the stock number.
    rows = await selectAllRows<Record<string, unknown>>((start, end) => {
      let query = supabase.from(view).select("*").order("stock_number").order("piece_id");
      if (from) query = query.gte("sold_date", from);
      if (to) query = query.lte("sold_date", to);
      return query.range(start, end) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Export failed", { status: 500 });
  }

  const first = rows[0];
  const cols = first ? Object.keys(first) : ["stock_number"];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock book");
  ws.columns = cols.map((c) => ({ header: prettyHeader(c), key: c, width: columnWidth(c) }));
  for (const r of rows)
    ws.addRow(
      cols.reduce(
        (o, c) => {
          o[c] = cellValue(c, r[c]);
          return o;
        },
        {} as Record<string, unknown>,
      ),
    );
  styleSheet(ws, cols);
  const buf = await wb.xlsx.writeBuffer();

  return downloadResponse(
    new Uint8Array(buf as ArrayBuffer),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    `stock-book-${scheme}.xlsx`,
  );
}
