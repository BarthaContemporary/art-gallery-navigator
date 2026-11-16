import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePieces } from "@/lib/piece-store";

/** Most works one call files; ids past this are left out and reported back. */
export const ADD_LIMIT = 2000;

export type AddToListResult =
  | {
      ok: true;
      listId: string;
      /** Rows newly added (works already in the list are not counted). */
      added: number;
      /** Works filed that were in the list already. */
      already: number;
      /** Works not filed: other register, gone from the stock, or past ADD_LIMIT. */
      skipped: number;
      /** Every work now in the list from this call, newly added or already there. */
      filedIds: string[];
      /**
       * Works deliberately not filed and still in the stock: the non-JvdB
       * ones, and any past ADD_LIMIT. Their flags must survive a "clear the
       * flags afterwards".
       */
      leftOutIds: string[];
    }
  | { ok: false; error: string; status: number };

/**
 * File pieces into a static list — an existing one, or a new one named here.
 * Shared by "add selected to list" and "add flagged to list".
 *
 * Only JvdB stock is filed from the inventory (the schema keys
 * piece_list_items on piece_ref since 0056 and would take either register;
 * the rule is the studio's): works from the other register are skipped
 * rather than failing the whole batch, and the caller can tell the user how
 * many were left out.
 *
 * OPEN, for the owner: the record page's "Add to list" files a work from
 * either register, and a live list can be saved over the other register, so
 * this rule is not the studio's everywhere. Whether lists may hold non-JvdB
 * works is a product decision; once made, either this filter goes or the
 * record page refuses an external work too.
 *
 * Nothing is written until the request is known to be good: a live list is
 * refused (its works are its saved filters, so rows filed into it would
 * change nothing), and a new list is created only once there is a work to
 * put in it, and removed again if filing fails.
 */
export async function addPiecesToList(
  supabase: SupabaseClient,
  userId: string,
  opts: { listId?: string; name?: string; pieceIds: string[] },
): Promise<AddToListResult> {
  const unique = [...new Set(opts.pieceIds)];
  const pieceIds = unique.slice(0, ADD_LIMIT);
  const beyondCap = unique.slice(ADD_LIMIT);
  if (pieceIds.length === 0) return { ok: false, error: "No items selected", status: 400 };

  const givenId = String(opts.listId ?? "").trim();
  const name = String(opts.name ?? "").trim().slice(0, 200);
  if (givenId) {
    // The request-scoped client, so RLS still decides what may be read.
    const { data: target, error } = await supabase
      .from("piece_lists")
      .select("id, name, is_dynamic")
      .eq("id", givenId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, status: 500 };
    if (!target) return { ok: false, error: "That list no longer exists.", status: 404 };
    if (target.is_dynamic) {
      return {
        ok: false,
        error: `“${target.name}” is a live list: its works are whatever its saved filters match, so works cannot be filed into it. Choose a static list or a new one.`,
        status: 400,
      };
    }
  } else if (!name) {
    return { ok: false, error: "Choose a list or enter a name", status: 400 };
  }

  let refs: Awaited<ReturnType<typeof resolvePieces>>;
  try {
    refs = await resolvePieces(supabase, pieceIds);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read the works", status: 500 };
  }
  const jvbIds = pieceIds.filter((id) => refs.get(id)?.table === "pieces");
  const externalIds = pieceIds.filter((id) => refs.get(id)?.table === "external_pieces");
  const skipped = unique.length - jvbIds.length;
  if (jvbIds.length === 0) {
    return { ok: false, error: "Only JvdB stock can be filed into a list", status: 400 };
  }

  let listId = givenId;
  let created = false;
  if (!listId) {
    const { data: row, error } = await supabase
      .from("piece_lists")
      .insert({ name, is_dynamic: false, created_by: userId })
      .select("id")
      .single();
    if (error || !row) return { ok: false, error: error?.message ?? "Could not create list", status: 500 };
    listId = row.id as string;
    created = true;
  }

  // Undo a list this call created, so a failure never leaves an empty list
  // behind under the name the user typed. A list passed in is never touched.
  const fail = async (message: string) => {
    if (created) await supabase.from("piece_lists").delete().eq("id", listId);
    return { ok: false as const, error: message, status: 500 };
  };

  const { data: mx, error: mxErr } = await supabase
    .from("piece_list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mxErr) return fail(mxErr.message);
  let sort = ((mx?.sort_order as number | undefined) ?? -1) + 1;
  const rows = jvbIds.map((pid) => ({ list_id: listId, piece_id: pid, sort_order: sort++ }));
  // With ignoreDuplicates PostgREST returns only the rows it inserted, so
  // the count says how many works are new to the list.
  const { data: inserted, error: insErr } = await supabase
    .from("piece_list_items")
    .upsert(rows, { onConflict: "list_id,piece_id", ignoreDuplicates: true })
    .select("piece_id");
  if (insErr) return fail(insErr.message);
  const added = (inserted ?? []).length;
  return {
    ok: true,
    listId,
    added,
    already: jvbIds.length - added,
    skipped,
    filedIds: jvbIds,
    leftOutIds: [...externalIds, ...beyondCap],
  };
}

/**
 * The flags to clear after filing the flagged works into a list: all of
 * them except the works deliberately left out, so a skipped non-JvdB work
 * (in no list now) stays findable by its flag. A flag on a work that no
 * longer resolves at all is cleared with the rest.
 */
export function flagsToClear(flaggedIds: readonly string[], leftOutIds: readonly string[]): string[] {
  const keep = new Set(leftOutIds);
  return flaggedIds.filter((id) => !keep.has(id));
}
