import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePieces } from "@/lib/piece-store";

/**
 * File pieces into a static list — an existing one, or a new one named here.
 * Shared by "add selected to list" and "add flagged to list".
 *
 * piece_list_items keys on the JvdB stock table, so works from the other
 * register are skipped rather than failing the whole batch; the caller can
 * tell the user how many were left out.
 */
export async function addPiecesToList(
  supabase: SupabaseClient,
  userId: string,
  opts: { listId?: string; name?: string; pieceIds: string[] },
): Promise<{ ok: true; listId: string; added: number; skipped: number } | { ok: false; error: string; status: number }> {
  const pieceIds = [...new Set(opts.pieceIds)].slice(0, 2000);
  if (pieceIds.length === 0) return { ok: false, error: "No items selected", status: 400 };

  let listId = String(opts.listId ?? "").trim();
  const name = String(opts.name ?? "").trim().slice(0, 200);
  if (!listId) {
    if (!name) return { ok: false, error: "Choose a list or enter a name", status: 400 };
    const { data: created, error } = await supabase
      .from("piece_lists")
      .insert({ name, is_dynamic: false, created_by: userId })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "Could not create list", status: 500 };
    listId = created.id;
  }

  const refs = await resolvePieces(supabase, pieceIds);
  const jvbIds = pieceIds.filter((id) => refs.get(id)?.table === "pieces");
  const skipped = pieceIds.length - jvbIds.length;
  if (jvbIds.length === 0) {
    return { ok: false, error: "Only JvdB stock can be filed into a list", status: 400 };
  }

  const { data: mx } = await supabase
    .from("piece_list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sort = ((mx?.sort_order as number | undefined) ?? -1) + 1;
  const rows = jvbIds.map((pid) => ({ list_id: listId, piece_id: pid, sort_order: sort++ }));
  const { error: insErr } = await supabase
    .from("piece_list_items")
    .upsert(rows, { onConflict: "list_id,piece_id", ignoreDuplicates: true });
  if (insErr) return { ok: false, error: insErr.message, status: 500 };
  return { ok: true, listId, added: rows.length, skipped };
}
