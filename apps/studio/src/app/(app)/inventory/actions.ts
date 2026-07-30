"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabase, requireSession, canSeeFinancials, hasRole } from "@/lib/supabase";
import { resolvePiece, LEDGER_TABLE, type Ledger } from "@/lib/piece-store";

const num = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nullable(),
);

const jsonStringArray = z.preprocess(
  (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  },
  z.array(z.string().transform((s) => s.trim())).transform((a) => a.filter(Boolean)),
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
  // dimensions_display is retired — see packages/db/src/dimensions.ts. The
  // column still holds legacy text but nothing reads or writes it.
  comments: z.string().trim().transform((v) => v || null),
  // Promoted legacy FileMaker fields
  source_note: z.string().trim().transform((v) => v || null),
  publications: jsonStringArray,
  exhibitions: jsonStringArray,
  purchased_from: z.string().trim().max(300).transform((v) => v || null),
  sold_to: z.string().trim().max(300).transform((v) => v || null),
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

/**
 * Start a new record as a draft and open it in the editor. Creating the piece
 * up front (rather than only on a final submit) is what lets the editor
 * autosave every change and lets the user attach import/export/temporary-export
 * shipments to the work while entering it — including stepping out to "Manage
 * shipments" and back without losing anything. A blank draft that is abandoned
 * can simply be deleted from the record (soft-delete).
 */
export async function createDraftPiece(formData?: FormData) {
  // Used as a bare form action, and with a hidden `ledger` field when the new
  // record belongs in the non-JvdB register.
  const ledger: Ledger = formData?.get("ledger") === "external" ? "external" : "jvb";
  const { user } = await requireSession();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from(LEDGER_TABLE[ledger])
    .insert({ created_by: user.id, updated_by: user.id })
    .select("stock_number")
    .single();
  if (error || !data)
    redirect(`/inventory?error=${encodeURIComponent(error?.message ?? "Could not start a new record")}`);
  redirect(`/inventory/${encodeURIComponent(data.stock_number)}/edit`);
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
  let targetId: string | null = null;

  if (stockNumber) {
    const ref = await resolvePiece(supabase, stockNumber);
    if (!ref) redirect(`/inventory?error=${encodeURIComponent("Record not found")}`);
    const { error } = await supabase
      .from(ref.table)
      .update({ ...parsed.data, updated_by: user.id })
      .eq("id", ref.id);
    if (error) redirect(`/inventory/${encodeURIComponent(stockNumber)}/edit?error=${encodeURIComponent(error.message)}`);
    targetStockNumber = ref.stockNumber;
    targetId = ref.id;
  } else {
    // stock_number omitted — the DB trigger assigns the next number from
    // whichever register's series this table belongs to.
    const { data, error } = await supabase
      .from("pieces")
      .insert({ ...parsed.data, created_by: user.id, updated_by: user.id })
      .select("id, stock_number")
      .single();
    if (error || !data) redirect(`/inventory/new?error=${encodeURIComponent(error?.message ?? "Insert failed")}`);
    targetStockNumber = data.stock_number;
    targetId = data.id;
  }

  // financials — only admin/accountant may write them
  if (canSeeFinancials(roles)) {
    const finParsed = financialsSchema.safeParse(
      formToObject(formData, Object.keys(financialsSchema.shape)),
    );
    if (finParsed.success && targetId) {
      // Financials key on the identity, so this is register-agnostic.
      await supabase
        .from("piece_financials")
        .update(finParsed.data)
        .eq("piece_id", targetId);
    }
  }

  revalidatePath("/inventory");
  redirect(`/inventory/${encodeURIComponent(targetStockNumber!)}`);
}

/**
 * Move a record between the JvdB register and the non-JvdB one.
 *
 * The database does the work in a single transaction: the row is copied to the
 * other stock table under a number from that register's series, the original is
 * deleted, and the move is logged. Everything attached to the work — images,
 * documents, financials, list memberships, offer lines, location history —
 * keys on the identity rather than on either stock table, so none of it moves
 * and none of it has to be rewritten.
 *
 * The RPC re-checks the admin role itself; this check is only so the UI can
 * fail early with a sentence the user can act on.
 */
export async function movePieceLedger(stockNumber: string, to: Ledger, note?: string) {
  const { roles } = await requireSession();
  const back = `/inventory/${encodeURIComponent(stockNumber)}`;
  if (!hasRole(roles, "admin")) {
    redirect(`${back}?error=${encodeURIComponent("Only an administrator can change a record's register")}`);
  }

  const supabase = await getSupabase();
  const ref = await resolvePiece(supabase, stockNumber);
  if (!ref) redirect(`/inventory?error=${encodeURIComponent("Record not found")}`);
  if (ref.ledger === to) redirect(back);

  const { data: newNumber, error } = await supabase.rpc("move_piece_ledger", {
    _piece_id: ref.id,
    _to: to,
    _note: note?.trim() || null,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/inventory");
  redirect(`/inventory/${encodeURIComponent(String(newNumber ?? ref.stockNumber))}`);
}
