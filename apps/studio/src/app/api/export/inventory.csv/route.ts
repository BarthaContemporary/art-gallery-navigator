import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { EXPORT_COLUMNS, loadInventoryExportRows, toExportRow } from "@/lib/inventory-query";

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

  // The screen's rows in the screen's order: search, list, flagged, register,
  // facets, flag pills and sort, resolved exactly as the inventory page does.
  const url = new URL(request.url);
  let rows: Record<string, unknown>[];
  try {
    rows = await loadInventoryExportRows(supabase, url.searchParams);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Export failed", { status: 500 });
  }

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
