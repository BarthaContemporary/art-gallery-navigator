/*
 * The inventory search behind "link to an existing work" (api/capture/
 * inventory/search). Postgres only: capture has no search-index credentials
 * and never will.
 *
 * The ranked pieces_search (both registers, partial stock and legacy numbers,
 * title, description and maker names, the studio's own search) supplies the
 * ids, best first; the rows shown come from vw_pieces_list, which leaves the
 * trash out and carries the maker's name. Both go through the signed-in
 * user's client, so row level security applies. The term is an RPC
 * parameter, never part of a filter string, so nothing in it can add filter
 * terms. Pure apart from the client handed in; `import type` only, so
 * node --test loads it as it is.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Works the picker lists. */
export const INVENTORY_SEARCH_LIMIT = 15;

/** One work as the picker shows it (the route's response shape). */
export type InventoryHit = { id: string; stock_number: string; title: string | null; maker: string | null };

type Row = { id: string; stock_number: string; title: string | null; maker_name: string | null };
type Answer<T> = { data: T[] | null; error: { message: string } | null };

/** Up to INVENTORY_SEARCH_LIMIT works matching `q`, best first; the error is the database's, rows then empty. */
export async function searchInventory(
  supabase: Pick<SupabaseClient, "rpc" | "from">,
  q: string,
): Promise<{ results: InventoryHit[]; error: { message: string } | null }> {
  const found = (await supabase
    .rpc("pieces_search", { q })
    .select("id")
    .limit(INVENTORY_SEARCH_LIMIT)) as unknown as Answer<{ id: string }>;
  if (found.error) return { results: [], error: found.error };
  const ids = [...new Set((found.data ?? []).map((h) => h.id))];
  if (ids.length === 0) return { results: [], error: null };

  const loaded = (await supabase
    .from("vw_pieces_list")
    .select("id, stock_number, title, maker_name")
    .in("id", ids)) as unknown as Answer<Row>;
  if (loaded.error) return { results: [], error: loaded.error };

  // .in() does not keep the rank: walk the ids. One that does not load (in
  // the trash, or hidden by a policy) is left out.
  const byId = new Map((loaded.data ?? []).map((r) => [r.id, r]));
  const results: InventoryHit[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) results.push({ id: p.id, stock_number: p.stock_number, title: p.title, maker: p.maker_name ?? null });
  }
  return { results, error: null };
}
