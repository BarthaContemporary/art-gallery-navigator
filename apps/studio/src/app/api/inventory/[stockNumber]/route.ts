import { NextResponse } from "next/server";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCIES = new Set(["GBP", "EUR", "USD", "CHF"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Spot GBP rate for a currency on a date, cached in exchange_rates. Uses the
 * Frankfurter API (ECB reference rates, dated). Returns null if unavailable.
 */
async function fxToGbp(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  currency: string,
  date: string | null,
): Promise<number | null> {
  if (currency === "GBP") return 1;
  if (!date) return null;

  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", currency)
    .eq("quote", "GBP")
    .eq("as_of", date)
    .maybeSingle();
  if (cached?.rate != null) return Number(cached.rate);

  try {
    const res = await fetch(
      `https://api.frankfurter.app/${date}?from=${currency}&to=GBP`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: { GBP?: number } };
    const rate = json?.rates?.GBP;
    if (typeof rate !== "number") return null;
    await supabase
      .from("exchange_rates")
      .upsert(
        { base: currency, quote: "GBP", rate, as_of: date },
        { onConflict: "base,quote,as_of" },
      );
    return rate;
  } catch {
    return null;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stockNumber: string }> },
) {
  const { stockNumber: rawStock } = await params;
  const stockNumber = decodeURIComponent(rawStock);

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await getSupabase();
  const fd = await req.formData();
  const str = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t || null;
  };
  const numv = (k: string) => {
    const t = String(fd.get(k) ?? "").trim();
    return t === "" ? null : Number(t);
  };

  const statusVal = String(fd.get("status") ?? "in_stock");

  const { error: pieceErr } = await supabase
    .from("pieces")
    .update({
      title: str("title"),
      maker_id: str("maker_id"),
      category_id: str("category_id"),
      location_id: str("location_id"),
      status: statusVal,
      medium: str("medium"),
      period: str("period"),
      origin_region: str("origin_region"),
      description: str("description"),
      condition_report: str("condition_report"),
      signature_inscription: str("signature_inscription"),
      box_type: str("box_type"),
      box_notes: str("box_notes"),
      height_cm: numv("height_cm"),
      width_cm: numv("width_cm"),
      depth_cm: numv("depth_cm"),
      length_cm: numv("length_cm"),
      diameter_cm: numv("diameter_cm"),
      weight_g: numv("weight_g"),
      dimensions_display: str("dimensions_display"),
      comments: str("comments"),
      source_note: str("source_note"),
      published_note: str("published_note"),
      shares_note: str("shares_note"),
      consignment_details: str("consignment_details"),
      purchased_from: str("purchased_from"),
      sold_to: str("sold_to"),
      document_note: str("document_note"),
      web_visible: fd.get("web_visible") === "on",
      updated_by: session.user.id,
    })
    .eq("stock_number", stockNumber);
  if (pieceErr)
    return NextResponse.json({ error: pieceErr.message }, { status: 500 });

  if (canSeeFinancials(session.roles)) {
    const { data: pieceRow } = await supabase
      .from("pieces")
      .select("id")
      .eq("stock_number", stockNumber)
      .single();
    if (pieceRow) {
      const purchaseCurrency = (String(fd.get("purchase_currency") ?? "GBP").toUpperCase());
      const sellCurrency = String(fd.get("sell_currency") ?? "GBP").toUpperCase();
      const purchaseCur = CURRENCIES.has(purchaseCurrency) ? purchaseCurrency : "GBP";
      const sellCur = CURRENCIES.has(sellCurrency) ? sellCurrency : "GBP";
      const purchaseDate = str("purchase_date");
      const soldDate = str("sold_date");
      const purchaseCost = numv("purchase_cost");
      const soldPrice = numv("sold_price");

      // Purchase side £.
      let purchaseFx = numv("purchase_fx") ?? 1;
      let purchaseCostGbp = numv("purchase_cost_gbp");
      if (purchaseCost != null) {
        const rate = await fxToGbp(supabase, purchaseCur, purchaseDate);
        if (rate != null) {
          purchaseFx = rate;
          purchaseCostGbp = round2(purchaseCost * rate);
        }
      }

      // Sale side £ — spot rate on the sale date.
      let sellFx = numv("sell_fx") ?? 1;
      let soldPriceGbp = numv("sold_price_gbp");
      if (soldPrice != null) {
        const rate = await fxToGbp(supabase, sellCur, soldDate);
        if (rate != null) {
          sellFx = rate;
          soldPriceGbp = round2(soldPrice * rate);
        }
      }

      await supabase
        .from("piece_financials")
        .update({
          purchase_date: purchaseDate,
          purchase_cost: purchaseCost,
          purchase_currency: purchaseCur,
          purchase_fx: purchaseFx,
          purchase_cost_gbp: purchaseCostGbp,
          restoration_cost_gbp: numv("restoration_cost_gbp") ?? 0,
          other_costs_gbp: numv("other_costs_gbp") ?? 0,
          marked_price_gbp: numv("marked_price_gbp"),
          sold_date: soldDate,
          sold_price: soldPrice,
          sell_currency: sellCur,
          sell_fx: sellFx,
          sold_price_gbp: soldPriceGbp,
          vat_treatment: String(fd.get("vat_treatment") ?? "margin_scheme"),
          buyer_contact_id: str("buyer_contact_id"),
        })
        .eq("piece_id", pieceRow.id);
    }
  }

  return NextResponse.json({ ok: true });
}
