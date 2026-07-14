import ExcelJS from "exceljs";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inventory export — XLSX opens directly in Proton Sheets / Excel. */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  let query = supabase.from("vw_pieces_list").select("*").order("stock_number");
  const status = url.searchParams.get("status");
  if (status) query = query.eq("status", status);
  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const cols = [
    "stock_number",
    "legacy_stock_number",
    "title",
    "maker_name",
    "category_name",
    "medium",
    "period",
    "origin_region",
    "status",
    "location_code",
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventory");
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
      "Content-Disposition": 'attachment; filename="inventory.xlsx"',
    },
  });
}
