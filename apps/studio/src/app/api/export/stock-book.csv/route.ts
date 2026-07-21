import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Margin-scheme stock book export for the accountant (HMRC VAT Notice 718). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles)) {
    return new Response("Forbidden", { status: 403 });
  }
  const supabase = await getSupabase();
  const url = new URL(request.url);
  const s = url.searchParams.get("scheme") ?? "";
  const scheme = ["margin", "standard", "zero_rated"].includes(s) ? s : "all";
  const view =
    scheme === "standard"
      ? "vw_stock_book_standard"
      : scheme === "zero_rated"
        ? "vw_stock_book_zero_rated"
        : scheme === "margin"
          ? "vw_stock_book"
          : "vw_stock_book_all";

  let query = supabase.from(view).select("*").order("stock_number");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) query = query.gte("sold_date", from);
  if (to) query = query.lte("sold_date", to);
  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const first = (rows ?? [])[0];
  const cols = first ? Object.keys(first) : ["stock_number"];
  const lines = [
    cols.join(","),
    ...(rows ?? []).map((r) =>
      cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","),
    ),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-book-${scheme}.csv"`,
    },
  });
}
