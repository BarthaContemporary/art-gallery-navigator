import ExcelJS from "exceljs";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Margin-scheme stock book export for the accountant (HMRC VAT Notice 718). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles)) {
    return new Response("Forbidden", { status: 403 });
  }
  const supabase = await getSupabase();
  const url = new URL(request.url);
  const scheme = url.searchParams.get("scheme") === "standard" ? "standard" : "margin";
  const view = scheme === "standard" ? "vw_stock_book_standard" : "vw_stock_book";

  let query = supabase.from(view).select("*").order("stock_number");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) query = query.gte("sold_date", from);
  if (to) query = query.lte("sold_date", to);
  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const first = (rows ?? [])[0];
  const cols = first ? Object.keys(first) : ["stock_number"];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock book");
  ws.columns = cols.map((c) => ({ header: c, key: c, width: 24 }));
  for (const r of rows ?? [])
    ws.addRow(
      cols.reduce(
        (o, c) => {
          o[c] = (r as Record<string, unknown>)[c] ?? "";
          return o;
        },
        {} as Record<string, unknown>,
      ),
    );
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();

  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stock-book-${scheme}.xlsx"`,
    },
  });
}
