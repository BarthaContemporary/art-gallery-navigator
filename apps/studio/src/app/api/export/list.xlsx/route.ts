import ExcelJS from "exceljs";
import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { prettyHeader, cellValue, columnWidth, styleSheet } from "@/lib/xlsx-clean";
import { resolveListPieceIds } from "@/lib/list-members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = [
  "stock_number",
  "title",
  "maker_name",
  "category_name",
  "medium",
  "period",
  "origin_region",
  "status",
  "location_code",
];

/** Export one inventory list as XLSX — opens in Proton Sheets / Excel. */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const listId = new URL(request.url).searchParams.get("list");
  if (!listId) return new Response("Missing list", { status: 400 });

  const { data: list } = await supabase
    .from("piece_lists")
    .select("id, name, is_dynamic, filter_rules")
    .eq("id", listId)
    .maybeSingle();
  if (!list) return new Response("List not found", { status: 404 });

  const ids = await resolveListPieceIds(supabase, list);

  let rows: Record<string, unknown>[] = [];
  if (ids.length > 0) {
    const { data, error } = await supabase.from("vw_pieces_list").select("*").in("id", ids);
    if (error) return new Response(error.message, { status: 500 });
    // Preserve the list's own order, which .in() does not.
    const byId = new Map((data ?? []).map((r) => [(r as { id: string }).id, r]));
    rows = ids
      .map((id) => byId.get(id))
      .filter(Boolean) as Record<string, unknown>[];
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Works");
  ws.columns = COLS.map((c) => ({ header: prettyHeader(c), key: c, width: columnWidth(c) }));
  for (const r of rows) {
    ws.addRow(
      COLS.reduce(
        (o, c) => {
          o[c] = cellValue(c, r[c]);
          return o;
        },
        {} as Record<string, unknown>,
      ),
    );
  }
  styleSheet(ws, COLS);

  const buf = await wb.xlsx.writeBuffer();
  const safe = String(list.name ?? "list")
    .replace(/[^\w\-. ]+/g, "")
    .trim()
    .slice(0, 60) || "list";

  return exportResponse(
    request,
    new Uint8Array(buf as ArrayBuffer),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    `${safe}.xlsx`,
    "Docs",
  );
}
