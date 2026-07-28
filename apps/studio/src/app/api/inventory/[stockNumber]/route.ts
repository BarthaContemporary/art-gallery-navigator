import { NextResponse } from "next/server";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCIES = new Set(["GBP", "EUR", "USD", "CHF", "JPY"]);
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
      `https://api.frankfurter.dev/v1/${date}?from=${currency}&to=GBP`,
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

/**
 * When a work is sold to a contact, auto-select the "related" area(s) of
 * interest on that contact — matched from the piece's category + origin.
 * Most-specific match wins: an area naming both origin and category beats one
 * naming just the category, which beats one naming just the origin.
 * Non-destructive: it only adds interests, never removes.
 */
async function autoAddInterestForPurchase(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  contactId: string,
  categoryId: string | null,
  originRegion: string | null,
) {
  let categoryName: string | null = null;
  if (categoryId) {
    const { data: cat } = await supabase
      .from("categories")
      .select("name")
      .eq("id", categoryId)
      .maybeSingle();
    categoryName = (cat?.name as string | undefined) ?? null;
  }
  const cat = categoryName?.trim().toLowerCase() || null;
  const org = originRegion?.trim().toLowerCase() || null;
  if (!cat && !org) return;

  const { data: areaRows } = await supabase
    .from("crm_interest_areas")
    .select("name, list_id");
  const areas = (areaRows ?? []) as { name: string; list_id: string | null }[];
  const has = (name: string, term: string | null) =>
    term != null && name.toLowerCase().includes(term);

  let matched = cat && org ? areas.filter((a) => has(a.name, cat) && has(a.name, org)) : [];
  if (matched.length === 0 && cat) matched = areas.filter((a) => has(a.name, cat));
  if (matched.length === 0 && org) matched = areas.filter((a) => has(a.name, org));
  if (matched.length === 0) return;

  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("custom_fields")
    .eq("id", contactId)
    .maybeSingle();
  const cf = ((contact?.custom_fields as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  const existing = Array.isArray(cf.interests) ? cf.interests.map((x) => String(x)) : [];
  const merged = [...new Set([...existing, ...matched.map((m) => m.name)])];
  if (merged.length !== existing.length) {
    await supabase
      .from("crm_contacts")
      .update({ custom_fields: { ...cf, interests: merged } })
      .eq("id", contactId);
  }

  const listRows = matched
    .filter((m) => m.list_id)
    .map((m) => ({ list_id: m.list_id as string, contact_id: contactId }));
  if (listRows.length) {
    await supabase
      .from("crm_list_members")
      .upsert(listRows, { onConflict: "list_id,contact_id", ignoreDuplicates: true });
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
  const jsonList = (k: string): string[] => {
    try {
      const parsed = JSON.parse(String(fd.get(k) ?? "[]"));
      return Array.isArray(parsed)
        ? parsed.map((x) => String(x).trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  };

  const ref = await resolvePiece(supabase, stockNumber);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error: pieceErr } = await supabase
    .from(ref.table)
    .update({
      title: str("title"),
      year: str("year"),
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
      publications: jsonList("publications"),
      exhibitions: jsonList("exhibitions"),
      // shares_note / consignment_details are edited via the separate
      // Consignment panel (/consignment endpoint); document_note is retired.
      purchased_from: str("purchased_from"),
      sold_to: str("sold_to"),
      web_visible: fd.get("web_visible") === "on",
      updated_by: session.user.id,
    })
    .eq("id", ref.id);
  if (pieceErr)
    return NextResponse.json({ error: pieceErr.message }, { status: 500 });

  if (canSeeFinancials(session.roles)) {
    // Financials key on the identity, not on either stock table.
    const pieceRow = { id: ref.id };
    if (pieceRow) {
      const purchaseCurrency = (String(fd.get("purchase_currency") ?? "GBP").toUpperCase());
      const sellCurrency = String(fd.get("sell_currency") ?? "GBP").toUpperCase();
      const purchaseCur = CURRENCIES.has(purchaseCurrency) ? purchaseCurrency : "GBP";
      const sellCur = CURRENCIES.has(sellCurrency) ? sellCurrency : "GBP";
      const purchaseDate = str("purchase_date");
      const soldDate = str("sold_date");
      const purchaseCost = numv("purchase_cost");
      const soldPrice = numv("sold_price");

      // Purchase side £ — entered manually, never auto-converted.
      const purchaseCostGbp = numv("purchase_cost_gbp");
      const purchaseFx =
        purchaseCost != null && purchaseCostGbp != null && purchaseCost !== 0
          ? round2(purchaseCostGbp / purchaseCost)
          : numv("purchase_fx") ?? 1;

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

      // Sold to a contact → auto-tag their related area(s) of interest.
      const buyerId = str("buyer_contact_id");
      if (buyerId) {
        await autoAddInterestForPurchase(
          supabase,
          buyerId,
          str("category_id"),
          str("origin_region"),
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
