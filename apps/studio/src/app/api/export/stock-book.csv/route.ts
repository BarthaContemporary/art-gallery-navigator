import { downloadResponse } from "@/lib/shared-drive";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";
import { csvLine } from "@/lib/csv";

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

  let query = supabase.from(view).select("*").order("stock_number");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) query = query.gte("sold_date", from);
  if (to) query = query.lte("sold_date", to);
  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const first = (rows ?? [])[0];
  // Columns and headers are the views' own, as the accountant's file has
  // always had them.
  const cols = first ? Object.keys(first) : ["stock_number"];
  // Text is guarded against formulas (descriptions and seller names are
  // typed in); figures stay numbers that a SUM includes.
  const lines = [
    csvLine(cols),
    ...(rows ?? []).map((r) => csvLine(cols.map((c) => (r as Record<string, unknown>)[c]))),
  ];
  return downloadResponse(lines.join("\n"), "text/csv; charset=utf-8", `stock-book-${scheme}.csv`);
}
