import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { csvLine } from "@/lib/csv";
import { EXPORT_COLUMNS, loadInventoryExportRows, toExportRow } from "@/lib/inventory-query";

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
    csvLine(cols),
    ...(rows ?? [])
      .map((r) => toExportRow(r as Record<string, unknown>))
      .map((r) => csvLine(cols.map((c) => r[c]))),
  ];
  return exportResponse(
    request,
    lines.join("\n"),
    "text/csv; charset=utf-8",
    "inventory.csv",
    "Docs",
  );
}
