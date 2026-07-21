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
    .select(
      "sold_price_gbp, total_cost_gbp, margin_gbp, net_profit_gbp, vat_treatment, import_type, import_vat_gbp, sold_date, piece:pieces ( consignment_share_pct, sale_handled_by_jvb )",
    )
    .gte("sold_date", startDate)
    .not("sold_date", "is", null);

  const rows = (data ?? []) as unknown as {
    sold_price_gbp: number | null;
    total_cost_gbp: number | null;
    margin_gbp: number | null;
    net_profit_gbp: number | null;
    vat_treatment: string | null;
    import_type: string | null;
    import_vat_gbp: number | null;
    piece: { consignment_share_pct: number | null; sale_handled_by_jvb: boolean | null } | null;
  }[];

  if (metric === "sales") {
    const value = rows.reduce((s, r) => s + (r.sold_price_gbp ?? 0), 0);
    return NextResponse.json({ value, format: "gbp" });
  }
  if (metric === "profit") {
    // For a work on consignment, J.v.d.B.'s net profit is its share £, not the
    // net of value — mirrors the Consignment panel + stock book:
    //   third-party sale → share % of the net sold price;
    //   J.v.d.B. sale    → share % of (sold − total cost − VAT due).
    const jvbShare = (r: (typeof rows)[number]): number => {
      const pct = (r.piece?.consignment_share_pct ?? 0) / 100;
      const sold = r.sold_price_gbp ?? 0;
      if (r.piece?.sale_handled_by_jvb === false) return pct * sold;
      const importVat =
        r.import_type === "import_vat_paid" && r.vat_treatment === "margin_scheme" ? r.import_vat_gbp ?? 0 : 0;
      const costs = (r.total_cost_gbp ?? 0) + importVat;
      let vat = 0;
      if (r.vat_treatment === "margin_scheme") vat = Math.max(0, sold - costs) / 6;
      else if (r.vat_treatment === "standard") vat = sold / 6;
      return pct * Math.max(0, sold - costs - vat);
    };
    const value = rows.reduce((s, r) => {
      const onConsignment = r.piece?.consignment_share_pct != null;
      return s + (onConsignment ? jvbShare(r) : r.net_profit_gbp ?? r.margin_gbp ?? 0);
    }, 0);
    return NextResponse.json({ value, format: "gbp" });
  }

  return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
}
