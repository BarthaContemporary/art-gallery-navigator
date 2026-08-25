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
  /**
   * Which register the saved view was built against: "external" for non-JvdB
   * works, "all" for both, anything else (including absent) for JvdB stock.
   * Absent on lists saved before the second register existed, which is exactly
   * the right default for them.
   */
  ledger?: string | null;
  /** true = only works ticked as Framed. Absent/false = no framing filter. */
  framed?: boolean | null;
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
  ledger: string;
  framed: boolean | null;
};

/** Resolve a saved view's register rule to a value to match, or null for both. */
function ledgerOf(rules: ListRules): "jvb" | "external" | null {
  if (rules.ledger === "all") return null;
  return rules.ledger === "external" ? "external" : "jvb";
}

/** Upper bound on a live list's size, matching the list detail page. */
const LIVE_LIMIT = 500;

/**
 * Piece ids belonging to a list, in display order: sort_order for a static
 * list, newest stock number first for a live one.
 */
/**
 * Works pinned OUT of a live list — piece_list_items rows with excluded=true.
 * A static list never has such rows (removal deletes the row outright).
 */
export async function listExcludedIds(
  supabase: SupabaseClient,
  listId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("piece_list_items")
    .select("piece_id")
    .eq("list_id", listId)
    .eq("excluded", true);
  return new Set(((data ?? []) as { piece_id: string }[]).map((r) => r.piece_id));
}

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
      .eq("excluded", false)
      .order("sort_order", { nullsFirst: true });
    return ((data ?? []) as { piece_id: string }[]).map((r) => r.piece_id);
  }

  const rules = list.filter_rules ?? {};
  const q = (rules.q ?? "").trim();
  // Applied AFTER the rules resolve, in this one place, so the inventory
  // filter, exports, labels and offers all agree on what the list contains.
  const excluded = await listExcludedIds(supabase, list.id);

  if (q) {
    // Text rules go through the ranked search, then the facets are applied to
    // the hits — the RPC has no facet parameters of its own.
    const { data: hits } = await supabase.rpc("pieces_search", { q });
    let f = (hits ?? []) as Hit[];
    const led = ledgerOf(rules);
    if (led) f = f.filter((h) => h.ledger === led);
    if (rules.status) f = f.filter((h) => h.status === rules.status);
    if (rules.category) f = f.filter((h) => h.category_id === rules.category);
    if (rules.location) f = f.filter((h) => h.location_id === rules.location);
    if (rules.framed) f = f.filter((h) => h.framed === true);
    if (excluded.size) f = f.filter((h) => !excluded.has(h.id));
    return f.slice(0, LIVE_LIMIT).map((h) => h.id);
  }

  let query = supabase
    .from("vw_pieces_list")
    .select("id")
    .order("stock_number", { ascending: false, nullsFirst: false })
    .limit(LIVE_LIMIT);
  const led = ledgerOf(rules);
  if (led) query = query.eq("ledger", led);
  if (rules.status) query = query.eq("status", rules.status);
  if (rules.category) query = query.eq("category_id", rules.category);
  if (rules.location) query = query.eq("location_id", rules.location);
  if (rules.framed) query = query.eq("framed", true);
  const { data } = await query;
  return ((data ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((pid) => !excluded.has(pid));
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
  // A text rule or any exclusion means the cheap head-count can't be trusted;
  // resolve properly (an exclusion only subtracts when the rules still match
  // the work, which the resolver gets right and arithmetic here would not).
  const excluded = await listExcludedIds(supabase, list.id);
  if ((rules.q ?? "").trim() || excluded.size > 0) {
    return (await resolveListPieceIds(supabase, list)).length;
  }
  let cq = supabase.from("vw_pieces_list").select("id", { count: "exact", head: true });
  const led = ledgerOf(rules);
  if (led) cq = cq.eq("ledger", led);
  if (rules.status) cq = cq.eq("status", rules.status);
  if (rules.category) cq = cq.eq("category_id", rules.category);
  if (rules.location) cq = cq.eq("location_id", rules.location);
  if (rules.framed) cq = cq.eq("framed", true);
  const { count } = await cq;
  return count ?? 0;
}
