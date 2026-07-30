import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Persist a hand-set display order.
 *
 * Shared by every reorderable surface (piece images, inventory lists, contact
 * lists, categories, locations) so the same two safeguards apply everywhere
 * rather than being remembered per route:
 *
 *   1. The id list arrives from a browser. Anything not already in scope is
 *      discarded, so a caller cannot renumber rows it was never shown — another
 *      work's images, for instance.
 *
 *   2. Ids the client did not send keep their place at the end. A tab that was
 *      open before an insert would otherwise silently drop the new row out of
 *      the ordering.
 *
 * The whole set is renumbered from zero rather than nudging individual values.
 * Relative moves are unreliable when rows share a number — which they do, since
 * new rows default to 0 and the FileMaker import left duplicates behind.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

export async function persistOrder(
  supabase: Db,
  table: string,
  ids: string[],
  /** Restricts which rows may be renumbered, e.g. { piece_id } for images. */
  scope?: Record<string, string>,
): Promise<void> {
  let query = supabase.from(table).select("id");
  for (const [col, val] of Object.entries(scope ?? {})) query = query.eq(col, val);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const allowed = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
  const ordered = ids.filter((id) => allowed.has(id));
  for (const id of allowed) if (!ordered.includes(id)) ordered.push(id);

  // A handful of rows per surface, so a write each is fine and keeps this
  // readable. Revisit only if some list grows into the hundreds.
  const results = await Promise.all(
    ordered.map((id, i) => supabase.from(table).update({ sort_order: i }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}
