import { readAmount } from "@/lib/amount";
import { NextResponse } from "next/server";
import { getSupabase, getSession, canEditRecords, canWriteFinancials } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";
import {
  canConvertSale,
  currencyCode,
  derivedRate,
  londonToday,
  samePence,
  shouldConvertSale,
  spotRateToGbp,
  type StoredSale,
} from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;
const VAT_TREATMENTS = new Set(["margin_scheme", "standard", "zero_rated", "outside_scope"]);
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

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
    .select("name");
  const areas = (areaRows ?? []) as { name: string }[];
  const has = (name: string, term: string | null) =>
    term != null && name.toLowerCase().includes(term);

  let matched = cat && org ? areas.filter((a) => has(a.name, cat) && has(a.name, org)) : [];
  if (matched.length === 0 && cat) matched = areas.filter((a) => has(a.name, cat));
  if (matched.length === 0 && org) matched = areas.filter((a) => has(a.name, org));
  if (matched.length === 0) return;

  const { data: contact, error: contactErr } = await supabase
    .from("crm_contacts")
    .select("custom_fields")
    .eq("id", contactId)
    .maybeSingle();
  // custom_fields also holds the second address, the AML confirmation and
  // the notes: written back whole below, so a failed or empty read must not
  // turn into {interests: [...]} over all of them.
  if (contactErr || !contact) return;
  const cf = ((contact.custom_fields as Record<string, unknown> | null) ?? {}) as Record<
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

  // No list write: the interest lists derive membership from
  // custom_fields.interests (migration 0060), so merging it above is enough.
}

/** The website-square choice from the form: an explicit flat/object, else auto. */
function presentationOf(v: FormDataEntryValue | null): "auto" | "flat" | "object" | "photo" {
  return v === "flat" || v === "object" || v === "photo" ? v : "auto";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stockNumber: string }> },
) {
  const { stockNumber: rawStock } = await params;
  const stockNumber = decodeURIComponent(rawStock);

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // The accountant reads records and figures but changes nothing (row
  // security gives that role no write policy); say so rather than answer
  // "saved" for an update that matched no row.
  if (!canEditRecords(session.roles)) {
    return NextResponse.json({ error: "Your role can read this record but not change it." }, { status: 403 });
  }

  const supabase = await getSupabase();
  const fd = await req.formData();
  const str = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t || null;
  };
  // Accepts "1,200", "£1,200.50" and "1250,50" as well as plain numbers (see
  // lib/amount). Something typed that is not an amount ("1e5") leaves the
  // stored figure alone instead of clearing it: the column is dropped from
  // the update below.
  const invalid = new Set<string>();
  const numv = (k: string) => {
    const r = readAmount(fd.get(k));
    if (r.invalid) invalid.add(k);
    return r.value;
  };
  const withoutInvalid = <T extends Record<string, unknown>>(row: T): T => {
    for (const k of invalid) delete row[k];
    return row;
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

  // The financial block is written only by a role that may write it, and
  // only when the form carried it: FinancialsFields always posts
  // vat_treatment, and a form rendered without the section (a role granted
  // while the editor was open) must not read as every figure cleared.
  const writeFinancials = canWriteFinancials(session.roles) && fd.has("vat_treatment");
  const buyerId = writeFinancials ? str("buyer_contact_id") : null;

  // What is stored before this save: whether the sale's inputs changed, and
  // whether the buyer (or the work's category or origin, which pick the
  // buyer's interests) changed.
  type StoredFin = {
    sold_price: number | string | null;
    sell_currency: string | null;
    sold_date: string | null;
    sold_price_gbp: number | string | null;
    purchase_currency: string | null;
    buyer_contact_id: string | null;
  };
  type Before = { category_id: string | null; origin_region: string | null };
  let storedFin: StoredFin | null = null;
  let before: Before | null = null;
  if (writeFinancials) {
    const [finRes, pieceRes] = await Promise.all([
      supabase
        .from("piece_financials")
        .select("sold_price, sell_currency, sold_date, sold_price_gbp, purchase_currency, buyer_contact_id")
        .eq("piece_id", ref.id)
        .maybeSingle(),
      buyerId
        ? supabase.from(ref.table).select("category_id, origin_region").eq("id", ref.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (finRes.error) return NextResponse.json({ error: finRes.error.message }, { status: 500 });
    storedFin = (finRes.data as StoredFin | null) ?? null;
    before = (pieceRes.data as Before | null) ?? null;
  }

  const { data: pieceRows, error: pieceErr } = await supabase
    .from(ref.table)
    .update(
      withoutInvalid({
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
        // An unchecked checkbox is simply absent from FormData, so absence means
        // not framed. The default columns above hold the framed size for a
        // framed work; the unframed_* columns record the work itself, and an
        // unframed work keeps none of them.
        framed: fd.get("framed") === "on",
        unframed_height_cm: fd.get("framed") === "on" ? numv("unframed_height_cm") : null,
        unframed_width_cm: fd.get("framed") === "on" ? numv("unframed_width_cm") : null,
        unframed_depth_cm: fd.get("framed") === "on" ? numv("unframed_depth_cm") : null,
        unframed_length_cm: fd.get("framed") === "on" ? numv("unframed_length_cm") : null,
        unframed_diameter_cm: fd.get("framed") === "on" ? numv("unframed_diameter_cm") : null,
        unframed_weight_g: fd.get("framed") === "on" ? numv("unframed_weight_g") : null,
        comments: str("comments"),
        source_note: str("source_note"),
        publications: jsonList("publications"),
        exhibitions: jsonList("exhibitions"),
        // shares_note / consignment_details are edited via the separate
        // Consignment panel (/consignment endpoint); document_note is retired.
        purchased_from: str("purchased_from"),
        sold_to: str("sold_to"),
        web_visible: fd.get("web_visible") === "on",
        // Website square: an explicit flat/object/photo, else auto.
        presentation: presentationOf(fd.get("presentation")),
        // "Mark catalogued" in the editor header. The field is posted only for a
        // record that arrived flagged, so absence leaves the column alone rather
        // than meaning false.
        ...(fd.has("needs_completion")
          ? { needs_completion: fd.get("needs_completion") === "on" }
          : {}),
        updated_by: session.user.id,
      }),
    )
    .eq("id", ref.id)
    .select("id");
  if (pieceErr)
    return NextResponse.json({ error: pieceErr.message }, { status: 500 });
  // Row security filters a refused update to no rows and no error; the
  // record may also have been deleted or moved to the other register in
  // another tab. Either way nothing was saved, and the editor must say so.
  if (!pieceRows || pieceRows.length === 0) {
    return NextResponse.json(
      { error: "This record could not be saved: it may have been deleted or moved in another tab. Reload the page." },
      { status: 403 },
    );
  }

  if (writeFinancials) {
    // Financials key on the identity, not on either stock table.
    const today = londonToday();

    // Currencies: a known ISO code is stored; anything else (legacy "Yen",
    // free text from the capture app) is left as stored, never turned into
    // GBP, and never used to look up a rate.
    const purchaseCode = currencyCode(fd.get("purchase_currency"));
    const sellCode = currencyCode(fd.get("sell_currency"));
    const purchaseCur = purchaseCode ?? storedFin?.purchase_currency ?? "GBP";
    const sellCur = sellCode ?? storedFin?.sell_currency ?? null;

    const soldDate = str("sold_date");
    const purchaseCost = numv("purchase_cost");
    const soldPrice = numv("sold_price");

    // Purchase side £ — entered by hand, never converted. A foreign purchase
    // whose £ equals its foreign amount is the unconverted figure 0066 had to
    // clear (a cost mirrored while the currency still said GBP): store no £.
    let purchaseCostGbp = numv("purchase_cost_gbp");
    if (
      purchaseCostGbp != null &&
      purchaseCost != null &&
      purchaseCost !== 0 &&
      purchaseCur.trim().toUpperCase() !== "GBP" &&
      samePence(purchaseCostGbp, purchaseCost)
    ) {
      purchaseCostGbp = null;
    }
    // The rate is a record of the two figures; left as stored when they do
    // not give one (the form posts no rate of its own).
    const purchaseFx = derivedRate(purchaseCostGbp, purchaseCost);

    // Sale side £ — the spot rate on the sale date, when the price, currency
    // or date changed (or nothing is stored yet). A recorded sale keeps its
    // £ and rate on an unrelated edit. sell_fx is left as stored whenever no
    // rate can be derived, so a lookup that fails never resets it to 1.
    const postedSoldGbp = numv("sold_price_gbp");
    const storedSale: StoredSale | null = storedFin
      ? {
          price: numOrNull(storedFin.sold_price),
          currency: storedFin.sell_currency,
          date: storedFin.sold_date,
          gbp: numOrNull(storedFin.sold_price_gbp),
        }
      : null;
    const nowSale = { price: soldPrice, currency: sellCur, date: soldDate };
    const sale: { sold_price_gbp?: number | null; sell_fx?: number } = {};
    const handTyped = () => {
      sale.sold_price_gbp = postedSoldGbp;
      const r = derivedRate(postedSoldGbp, soldPrice);
      if (r != null) sale.sell_fx = r;
    };
    if (invalid.has("sold_price") || invalid.has("sold_price_gbp")) {
      // Not an amount: leave the sale's £ and rate as they are.
    } else if (soldPrice == null) {
      // The price was cleared: its £ goes with it. With no price before
      // either, a stored £ is left alone.
      if (storedSale?.price != null) sale.sold_price_gbp = null;
    } else if (shouldConvertSale(nowSale, storedSale, today)) {
      const rate = await spotRateToGbp(supabase, sellCur, soldDate, today);
      if (rate != null) {
        sale.sell_fx = rate;
        sale.sold_price_gbp = round2(soldPrice * rate);
      } else {
        handTyped();
      }
    } else if (postedSoldGbp != null && !samePence(postedSoldGbp, storedSale?.gbp)) {
      // Inputs unchanged and a £ on record. The editor lets the £ be typed
      // only where no rate exists for these inputs, so a different figure is
      // taken only then; otherwise (an editor open since before this rule)
      // the recorded £ stands.
      const rate = canConvertSale(nowSale, today) ? await spotRateToGbp(supabase, sellCur, soldDate, today) : null;
      if (rate == null) handTyped();
    }

    const vatTreatment = String(fd.get("vat_treatment") ?? "");

    // A failed financial write must fail the request: the autosave client
    // skips resending a form it was told is saved, so a silent 200 here
    // would lose the edit for good.
    const { data: finRows, error: finErr } = await supabase
      .from("piece_financials")
      .update(
        withoutInvalid({
          purchase_date: str("purchase_date"),
          purchase_cost: purchaseCost,
          ...(purchaseCode ? { purchase_currency: purchaseCode } : {}),
          ...(purchaseFx != null ? { purchase_fx: purchaseFx } : {}),
          purchase_cost_gbp: purchaseCostGbp,
          restoration_cost_gbp: numv("restoration_cost_gbp") ?? 0,
          other_costs_gbp: numv("other_costs_gbp") ?? 0,
          marked_price_gbp: numv("marked_price_gbp"),
          sold_date: soldDate,
          sold_price: soldPrice,
          ...(sellCode ? { sell_currency: sellCode } : {}),
          ...sale,
          ...(VAT_TREATMENTS.has(vatTreatment) ? { vat_treatment: vatTreatment } : {}),
          buyer_contact_id: buyerId,
        }),
      )
      .eq("piece_id", ref.id)
      .select("piece_id");
    if (finErr)
      return NextResponse.json({ error: finErr.message }, { status: 500 });
    if (!finRows || finRows.length === 0) {
      return NextResponse.json(
        { error: "The financial figures could not be saved for this record. Reload the page and try again." },
        { status: 403 },
      );
    }

    // Sold to a contact → auto-tag their related area(s) of interest. Only
    // when the buyer changed, or the category or origin that pick the
    // interests did: not on every save of a sold work, which also put back
    // an interest removed from the contact on purpose.
    if (buyerId) {
      const buyerChanged = buyerId !== (storedFin?.buyer_contact_id ?? null);
      const placeChanged =
        before != null &&
        ((before.category_id ?? null) !== str("category_id") || (before.origin_region ?? null) !== str("origin_region"));
      if (buyerChanged || placeChanged) {
        await autoAddInterestForPurchase(supabase, buyerId, str("category_id"), str("origin_region"));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
