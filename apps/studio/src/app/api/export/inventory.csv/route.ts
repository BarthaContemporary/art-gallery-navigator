import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { applyInventoryFilters, EXPORT_COLUMNS, toExportRow } from "@/lib/inventory-query";

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Inventory export — CSV opens directly in Proton Sheets / Excel. */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const query = applyInventoryFilters(
    supabase.from("vw_pieces_list").select("*").order("stock_number"),
    url.searchParams,
  );
  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const cols = EXPORT_COLUMNS;
  const lines = [
    cols.join(","),
    ...(rows ?? [])
      .map((r) => toExportRow(r as Record<string, unknown>))
      .map((r) => cols.map((c) => csvCell(r[c])).join(",")),
  ];
  return exportResponse(
    request,
    lines.join("\n"),
    "text/csv; charset=utf-8",
    "inventory.csv",
    "Docs",
  );
}
