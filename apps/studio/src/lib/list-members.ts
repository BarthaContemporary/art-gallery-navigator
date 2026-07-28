import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolving a piece list's membership, in one place.
 *
 * This logic was previously copied into the list detail page, the Library
 * panel and the lists index — and the copies disagreed. Counting the join
 * table reported 0 for every live list, because a live list keeps no rows
 * there: its membership *is* the saved filters, re-run on read. Anything that
 * needs a list's contents should call in here.
 */

export type ListRules = {
  q?: string | null;
  status?: string | null;
  category?: string | null;
  location?: string | null;
};

export type ListLike = {
  id: string;
  is_dynamic?: boolean | null;
  filter_rules?: ListRules | null;
};

type Hit = {
  id: string;
  status: string;
  category_id: string | null;
  location_id: string | null;
};

/** Upper bound on a live list's size, matching the list detail page. */
const LIVE_LIMIT = 500;

/**
 * Piece ids belonging to a list, in display order: sort_order for a static
 * list, newest stock number first for a live one.
 */
export async function resolveListPieceIds(
  // The client is either the request-scoped or the service client; both satisfy
  // the calls used here.
  supabase: SupabaseClient,
  list: ListLike,
): Promise<string[]> {
  if (!list.is_dynamic) {
    const { data } = await supabase
      .from("piece_list_items")
      .select("piece_id, sort_order")
      .eq("list_id", list.id)
      .order("sort_order", { nullsFirst: true });
    return ((data ?? []) as { piece_id: string }[]).map((r) => r.piece_id);
  }

  const rules = list.filter_rules ?? {};
  const q = (rules.q ?? "").trim();

  if (q) {
    // Text rules go through the ranked search, then the facets are applied to
    // the hits — the RPC has no facet parameters of its own.
    const { data: hits } = await supabase.rpc("pieces_search", { q });
    let f = (hits ?? []) as Hit[];
    if (rules.status) f = f.filter((h) => h.status === rules.status);
    if (rules.category) f = f.filter((h) => h.category_id === rules.category);
    if (rules.location) f = f.filter((h) => h.location_id === rules.location);
    return f.slice(0, LIVE_LIMIT).map((h) => h.id);
  }

  let query = supabase
    .from("vw_pieces_list")
    .select("id")
    .order("stock_number", { ascending: false, nullsFirst: false })
    .limit(LIVE_LIMIT);
  if (rules.status) query = query.eq("status", rules.status);
  if (rules.category) query = query.eq("category_id", rules.category);
  if (rules.location) query = query.eq("location_id", rules.location);
  const { data } = await query;
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/**
 * How many works a list holds. Cheaper than resolving ids for facet-only live
 * lists, which is the common case.
 */
export async function countListMembers(
  supabase: SupabaseClient,
  list: ListLike & { piece_list_items?: { count: number }[] },
): Promise<number> {
  if (!list.is_dynamic) {
    return list.piece_list_items?.[0]?.count ?? 0;
  }
  const rules = list.filter_rules ?? {};
  if ((rules.q ?? "").trim()) {
    return (await resolveListPieceIds(supabase, list)).length;
  }
  let cq = supabase.from("vw_pieces_list").select("id", { count: "exact", head: true });
  if (rules.status) cq = cq.eq("status", rules.status);
  if (rules.category) cq = cq.eq("category_id", rules.category);
  if (rules.location) cq = cq.eq("location_id", rules.location);
  const { count } = await cq;
  return count ?? 0;
}
