import { NextResponse } from "next/server";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";
import { consignmentSplit, saleNetProfit } from "@/lib/consignment";
import { loadPieceRows } from "@/lib/piece-store";
import { londonToday } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS: Record<string, number> = { month: 30, quarter: 91, year: 365 };
/** PostgREST's row cap (supabase/config.toml max_rows): read the sales in pages of it. */
const PAGE = 1000;

function startISO(period: string): string {
  const days = DAYS[period] ?? 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

type SaleRow = {
  piece_id: string;
  sold_price_gbp: number | null;
  purchase_cost_gbp: number | null;
  restoration_cost_gbp: number | null;
  other_costs_gbp: number | null;
  net_profit_gbp: number | null;
  vat_treatment: string | null;
  import_type: string | null;
  import_vat_gbp: number | null;
};

type WorkRow = {
  id: string;
  ledger: string | null;
  deleted_at: string | null;
  consignment_share_pct: number | null;
  sale_handled_by_jvb: boolean | null;
};

const n = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));

/** Dashboard KPI: objects added / total sales / net profit for a period. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") ?? "added";
  const period = url.searchParams.get("period") ?? "month";
  const supabase = await getSupabase();

  if (metric === "added") {
    const { count, error } = await supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", startISO(period));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ value: count ?? 0, format: "count" });
  }

  // Sales + profit are financial — admin/accountant only.
  if (!canSeeFinancials(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (metric !== "sales" && metric !== "profit") {
    return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
  }

  // Sales dated in the period up to today (a mistyped future date is not a
  // sale yet). A failed read answers an error, which the panel shows as "—"
  // rather than as £0.
  const startDate = startISO(period).slice(0, 10);
  const today = londonToday();
  const sales: SaleRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("piece_financials")
      .select(
        "piece_id, sold_price_gbp, purchase_cost_gbp, restoration_cost_gbp, other_costs_gbp, net_profit_gbp, vat_treatment, import_type, import_vat_gbp",
      )
      .gte("sold_date", startDate)
      .lte("sold_date", today)
      .order("piece_id")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const page = (data ?? []) as SaleRow[];
    sales.push(...page);
    if (page.length < PAGE) break;
  }

  let works: Map<string, WorkRow>;
  try {
    works = await loadPieceRows<WorkRow>(
      supabase,
      sales.map((r) => r.piece_id),
      "id, ledger, deleted_at, consignment_share_pct, sale_handled_by_jvb",
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  // Headline figures are JvdB stock only (the dashboard says so): a non-JvdB
  // work's sale, or a work in the trash, is not counted.
  const rows = sales.flatMap((r) => {
    const work = works.get(r.piece_id);
    return work && work.ledger === "jvb" && work.deleted_at == null ? [{ ...r, work }] : [];
  });

  if (metric === "sales") {
    const value = rows.reduce((s, r) => s + n(r.sold_price_gbp), 0);
    return NextResponse.json({ value, format: "gbp" });
  }

  // Net profit: after VAT and costs, worked out per sale by the editor's and
  // the stock book's rules (lib/consignment). For a work on consignment,
  // J.v.d.B.'s net profit is its share of the profit pool: purchase cost
  // drives the margin VAT but is excluded from the shared pool; restoration /
  // other / import VAT are carried by J.v.d.B. out of its share.
  const value = rows.reduce((s, r) => {
    if (r.sold_price_gbp == null) return s;
    const importVatPaid = r.import_type === "import_vat_paid" ? n(r.import_vat_gbp) : 0;
    const treatment = r.vat_treatment ?? "margin_scheme";
    if (r.work.consignment_share_pct != null) {
      return (
        s +
        consignmentSplit({
          amount: n(r.sold_price_gbp),
          vatTreatment: treatment,
          saleHandledByJvb: r.work.sale_handled_by_jvb,
          purchaseCostGbp: n(r.purchase_cost_gbp),
          extraCostsGbp: n(r.restoration_cost_gbp) + n(r.other_costs_gbp),
          importVatPaidGbp: importVatPaid,
          sharePct: r.work.consignment_share_pct,
        }).jvbNetProfit
      );
    }
    // With no purchase £ there is no cost base: the whole sale would count as
    // profit. FileMaker's own net profit is the better figure for a legacy
    // sale that has one; otherwise the sale is left out, as the stock book's
    // margin total leaves it out.
    if (r.purchase_cost_gbp == null) return r.net_profit_gbp != null ? s + n(r.net_profit_gbp) : s;
    return (
      s +
      saleNetProfit({
        soldGbp: n(r.sold_price_gbp),
        vatTreatment: treatment,
        saleHandledByJvb: r.work.sale_handled_by_jvb,
        totalCostGbp: n(r.purchase_cost_gbp) + n(r.restoration_cost_gbp) + n(r.other_costs_gbp),
        importVatPaidGbp: importVatPaid,
      })
    );
  }, 0);
  return NextResponse.json({ value: Math.round(value * 100) / 100, format: "gbp" });
}
