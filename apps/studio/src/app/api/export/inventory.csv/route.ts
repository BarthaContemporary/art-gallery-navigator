import { getSupabase } from "@/lib/supabase";

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
  const lines = [
    cols.join(","),
    ...(rows ?? []).map((r) =>
      cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","),
    ),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventory.csv"',
    },
  });
}
