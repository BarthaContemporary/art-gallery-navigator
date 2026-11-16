"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase, requireSession, hasRole } from "@/lib/supabase";
import { LEDGER_TABLE, resolvePiece, type Ledger } from "@/lib/piece-store";

// The editor saves through its autosave route,
// /api/inventory/[stockNumber] (PATCH), which parses every field the form
// posts. There is no second save path to keep in step with it.

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
