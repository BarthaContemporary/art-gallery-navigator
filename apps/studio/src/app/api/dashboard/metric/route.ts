import { NextResponse } from "next/server";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS: Record<string, number> = { month: 30, quarter: 91, year: 365 };

function startISO(period: string): string {
  const days = DAYS[period] ?? 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Dashboard KPI: objects added / total sales / net profit for a period. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") ?? "added";
  const period = url.searchParams.get("period") ?? "month";
  const supabase = await getSupabase();

  if (metric === "added") {
    const { count } = await supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", startISO(period));
    return NextResponse.json({ value: count ?? 0, format: "count" });
  }

  // Sales + profit are financial — admin/accountant only.
  if (!canSeeFinancials(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startDate = startISO(period).slice(0, 10);
  const { data } = await supabase
    .from("piece_financials")
    .select("sold_price_gbp, margin_gbp, net_profit_gbp, sold_date")
    .gte("sold_date", startDate)
    .not("sold_date", "is", null);

  const rows = (data ?? []) as {
    sold_price_gbp: number | null;
    margin_gbp: number | null;
    net_profit_gbp: number | null;
  }[];

  if (metric === "sales") {
    const value = rows.reduce((s, r) => s + (r.sold_price_gbp ?? 0), 0);
    return NextResponse.json({ value, format: "gbp" });
  }
  if (metric === "profit") {
    const value = rows.reduce((s, r) => s + (r.net_profit_gbp ?? r.margin_gbp ?? 0), 0);
    return NextResponse.json({ value, format: "gbp" });
  }

  return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
}
