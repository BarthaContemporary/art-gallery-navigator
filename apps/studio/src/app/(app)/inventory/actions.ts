"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabase, requireSession, canSeeFinancials } from "@/lib/supabase";

const num = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nullable(),
);

const pieceSchema = z.object({
  title: z.string().trim().max(500).transform((v) => v || null),
  year: z.string().trim().max(50).transform((v) => v || null),
  maker_id: z.string().uuid().nullable().or(z.literal("").transform(() => null)),
  category_id: z.string().uuid().nullable().or(z.literal("").transform(() => null)),
  location_id: z.string().uuid().nullable().or(z.literal("").transform(() => null)),
  status: z.enum([
    "in_stock",
    "reserved",
    "consigned_in",
    "consigned_out",
    "sold",
    "gifted",
    "returned",
    "written_off",
  ]),
  medium: z.string().trim().max(300).transform((v) => v || null),
  period: z.string().trim().max(200).transform((v) => v || null),
  origin_region: z.string().trim().max(200).transform((v) => v || null),
  description: z.string().trim().transform((v) => v || null),
  condition_report: z.string().trim().transform((v) => v || null),
  signature_inscription: z.string().trim().transform((v) => v || null),
  box_type: z.string().trim().max(200).transform((v) => v || null),
  box_notes: z.string().trim().transform((v) => v || null),
  height_cm: num,
  width_cm: num,
  depth_cm: num,
  length_cm: num,
  diameter_cm: num,
  weight_g: num,
  dimensions_display: z.string().trim().max(300).transform((v) => v || null),
  comments: z.string().trim().transform((v) => v || null),
  // Promoted legacy FileMaker fields
  source_note: z.string().trim().transform((v) => v || null),
  published_note: z.string().trim().transform((v) => v || null),
  shares_note: z.string().trim().transform((v) => v || null),
  consignment_details: z.string().trim().transform((v) => v || null),
  purchased_from: z.string().trim().max(300).transform((v) => v || null),
  sold_to: z.string().trim().max(300).transform((v) => v || null),
  document_note: z.string().trim().transform((v) => v || null),
  web_visible: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

const financialsSchema = z.object({
  purchase_date: z.string().transform((v) => v || null),
  purchase_cost: num,
  purchase_currency: z.string().trim().max(3).transform((v) => v || "GBP"),
  purchase_fx: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number()),
  purchase_cost_gbp: num,
  restoration_cost_gbp: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number()),
  other_costs_gbp: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number()),
  marked_price_gbp: num,
  sold_date: z.string().transform((v) => v || null),
  sold_price: num,
  sell_currency: z.string().trim().max(3).transform((v) => v || "GBP"),
  sell_fx: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number()),
  sold_price_gbp: num,
  vat_treatment: z.enum(["margin_scheme", "standard", "zero_rated", "outside_scope"]),
});

function formToObject(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? ""]));
}

export async function savePiece(
  stockNumber: string | null,
  formData: FormData,
) {
  const { user, roles } = await requireSession();
  const supabase = await getSupabase();

  const parsed = pieceSchema.safeParse(
    formToObject(formData, Object.keys(pieceSchema.shape)),
  );
  if (!parsed.success) {
    redirect(
      `${stockNumber ? `/inventory/${encodeURIComponent(stockNumber)}/edit` : "/inventory/new"}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
    );
  }

  let targetStockNumber = stockNumber;

  if (stockNumber) {
    const { error } = await supabase
      .from("pieces")
      .update({ ...parsed.data, updated_by: user.id })
      .eq("stock_number", stockNumber);
    if (error) redirect(`/inventory/${encodeURIComponent(stockNumber)}/edit?error=${encodeURIComponent(error.message)}`);
  } else {
    // stock_number omitted — the DB trigger assigns the next YYYY-NNNN
    const { data, error } = await supabase
      .from("pieces")
      .insert({ ...parsed.data, created_by: user.id, updated_by: user.id })
      .select("stock_number")
      .single();
    if (error || !data) redirect(`/inventory/new?error=${encodeURIComponent(error?.message ?? "Insert failed")}`);
    targetStockNumber = data.stock_number;
  }

  // financials — only admin/accountant may write them
  if (canSeeFinancials(roles)) {
    const finParsed = financialsSchema.safeParse(
      formToObject(formData, Object.keys(financialsSchema.shape)),
    );
    if (finParsed.success && targetStockNumber) {
      const { data: pieceRow } = await supabase
        .from("pieces")
        .select("id")
        .eq("stock_number", targetStockNumber)
        .single();
      if (pieceRow) {
        await supabase
          .from("piece_financials")
          .update(finParsed.data)
          .eq("piece_id", pieceRow.id);
      }
    }
  }

  revalidatePath("/inventory");
  redirect(`/inventory/${encodeURIComponent(targetStockNumber!)}`);
}
