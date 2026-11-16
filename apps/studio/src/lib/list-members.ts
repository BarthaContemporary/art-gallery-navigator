import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFacet, facetMatches } from "@/lib/facet";
import { selectInChunks } from "@/lib/chunk";

/**
 * Resolving a piece list's membership, in one place.
 *
 * This logic was previously copied into the list detail page, the Library
 * panel and the lists index — and the copies disagreed. Counting the join
 * table reported 0 for every live list, because a live list keeps no rows
 * there: its membership *is* the saved filters, re-run on read. Anything that
 * needs a list's contents should call in here.
 *
 * A failed read throws (as lib/chunk's selectInChunks does) rather than
 * answering with an empty list: the website sync, the exports, offers and the
 * freeze/publish actions all act on the answer, and an empty list published
 * or copied because PostgREST failed once is worse than an error.
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

/**
 * The columns the text-rule branch reads from each search hit. pieces_search
 * returns whole stock rows (descriptions, condition reports, the search
 * vector) unless told otherwise. framed and web_visible must stay: the framed
 * rule and the website sync's visibility filter read them.
 */
const HIT_COLUMNS = "id, status, category_id, location_id, ledger, framed, web_visible";

type Hit = {
  id: string;
  status: string;
  category_id: string | null;
  location_id: string | null;
  ledger: string;
  framed: boolean | null;
  web_visible?: boolean | null;
};

/**
 * The register rule, read the same way by the inventory URL (`ledger`), a
 * saved live list and the exports: "all" means both registers (null, no
 * filter), "external" the non-JvdB register, anything else (absent included)
 * JvdB stock.
 */
export function ledgerFilterOf(raw: string | null | undefined): "jvb" | "external" | null {
  if (raw === "all") return null;
  return raw === "external" ? "external" : "jvb";
}

/**
 * The register rule in words, for a live list's summary; null for JvdB stock,
 * which every list saved before the second register already means.
 */
export function ledgerRuleLabel(raw: string | null | undefined): string | null {
  const led = ledgerFilterOf(raw);
  return led === null ? "both registers" : led === "external" ? "not JvdB" : null;
}

/** Upper bound on a live list's size, matching the list detail page. */
export const LIVE_LIMIT = 500;

/**
 * Works pinned OUT of a live list — piece_list_items rows with excluded=true.
 * A static list never has such rows (removal deletes the row outright).
 * Throws on a failed read: an empty set would quietly bring pinned-out works
 * back.
 */
export async function listExcludedIds(
  supabase: SupabaseClient,
  listId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("piece_list_items")
    .select("piece_id")
    .eq("list_id", listId)
    .eq("excluded", true);
  if (error) throw new Error(`Could not read the list's exclusions: ${error.message}`);
  return new Set(((data ?? []) as { piece_id: string }[]).map((r) => r.piece_id));
}

/** What a list holds: the ids in display order, and how many matched before the live cap. */
export type ListMembership = {
  ids: string[];
  /**
   * Works the list's rules match, exclusions applied, before LIVE_LIMIT. Equal
   * to ids.length unless a live list was cut at the cap.
   */
  total: number;
};

/**
 * Piece ids belonging to a list, in display order: sort_order for a static
 * list, newest stock number first for a live one. Works in the trash are left
 * out. Throws on a failed read.
 */
export async function resolveListPieceIds(
  // The client is either the request-scoped or the service client; both satisfy
  // the calls used here.
  supabase: SupabaseClient,
  list: ListLike,
  opts: { webVisibleOnly?: boolean } = {},
): Promise<string[]> {
  return (await resolveMembers(supabase, list, { ...opts, withTotal: false })).ids;
}

/**
 * resolveListPieceIds plus the size before the live cap, for the surfaces
 * that have to say when a live list was cut (the list page, the lists index).
 */
export async function resolveListMembership(
  supabase: SupabaseClient,
  list: ListLike,
  opts: { webVisibleOnly?: boolean } = {},
): Promise<ListMembership> {
  return resolveMembers(supabase, list, { ...opts, withTotal: true });
}

/** The slice of a PostgREST builder the live rules need. */
type RuleQuery<T> = {
  eq: (column: string, value: unknown) => T;
  neq: (column: string, value: string) => T;
  or: (filters: string) => T;
};

/** A live list's rules (register, website, status, category, location, framed) on a vw_pieces_list query. */
function applyListRules<T extends RuleQuery<T>>(query: T, rules: ListRules, webVisibleOnly: boolean): T {
  let q = query;
  const led = ledgerFilterOf(rules.ledger);
  if (led) q = q.eq("ledger", led);
  if (webVisibleOnly) q = q.eq("web_visible", true);
  q = applyFacet(q, "status", rules.status);
  q = applyFacet(q, "category_id", rules.category, { nullable: true });
  q = applyFacet(q, "location_id", rules.location, { nullable: true });
  if (rules.framed) q = q.eq("framed", true);
  return q;
}

type ViewIds = { data: { id: string }[] | null; error: { message: string } | null; count?: number | null };

// The builders, typed by hand for applyListRules: inferring T from the
// supabase-js builder types sends TypeScript into "type instantiation is
// excessively deep" at some of these call sites.
interface IdsQuery extends RuleQuery<IdsQuery>, PromiseLike<ViewIds> {}
interface CountQuery
  extends RuleQuery<CountQuery>,
    PromiseLike<{ count: number | null; error: { message: string } | null }> {}

async function resolveMembers(
  supabase: SupabaseClient,
  list: ListLike,
  opts: { webVisibleOnly?: boolean; withTotal: boolean },
): Promise<ListMembership> {
  const webVisibleOnly = Boolean(opts.webVisibleOnly);
  if (!list.is_dynamic) {
    const { data, error } = await supabase
      .from("piece_list_items")
      .select("piece_id, sort_order")
      .eq("list_id", list.id)
      .eq("excluded", false)
      .order("sort_order", { nullsFirst: true });
    if (error) throw new Error(`Could not read the list's works: ${error.message}`);
    const ordered = ((data ?? []) as { piece_id: string }[]).map((r) => r.piece_id);
    // A trashed work keeps its row (restoring it from the bin brings the
    // membership back), so the members are read through vw_pieces_list,
    // which leaves soft-deleted works out, as the live branches already do.
    // Walk the ordered rows: .in() does not keep the hand-set order.
    const rows = await selectInChunks<{ id: string; web_visible: boolean | null }>(ordered, (chunk) =>
      supabase.from("vw_pieces_list").select("id, web_visible").in("id", chunk),
    );
    const keep = new Set(rows.filter((r) => !webVisibleOnly || r.web_visible === true).map((r) => r.id));
    const ids = ordered.filter((pid) => keep.has(pid));
    return { ids, total: ids.length };
  }

  const rules = list.filter_rules ?? {};
  const q = (rules.q ?? "").trim();
  // Applied BEFORE the cap, in this one place, so the inventory filter,
  // exports, labels and offers all agree on what the list contains and a
  // pinned-out work never takes a slot.
  const excluded = await listExcludedIds(supabase, list.id);

  if (q) {
    // Text rules go through the ranked search, then the facets are applied to
    // the hits — the RPC has no facet parameters of its own.
    const { data: hits, error } = await supabase.rpc("pieces_search", { q }).select(HIT_COLUMNS);
    if (error) throw new Error(`Could not run the list's search: ${error.message}`);
    let f = (hits ?? []) as unknown as Hit[];
    const led = ledgerFilterOf(rules.ledger);
    if (led) f = f.filter((h) => h.ledger === led);
    if (rules.status) f = f.filter((h) => facetMatches(rules.status, h.status));
    if (rules.category) f = f.filter((h) => facetMatches(rules.category, h.category_id));
    if (rules.location) f = f.filter((h) => facetMatches(rules.location, h.location_id));
    if (rules.framed) f = f.filter((h) => h.framed === true);
    // For the website the cap must apply AFTER the visibility filter, or a
    // large live list would hide older web-visible works.
    if (webVisibleOnly) f = f.filter((h) => h.web_visible === true);
    if (excluded.size) f = f.filter((h) => !excluded.has(h.id));
    return { ids: f.slice(0, LIVE_LIMIT).map((h) => h.id), total: f.length };
  }

  // Enough rows that the cap still holds LIVE_LIMIT works once the pinned-out
  // ones are taken away. Newest stock number first; the id only breaks a tie
  // between the two registers' numbering.
  const select = supabase
    .from("vw_pieces_list")
    .select("id", opts.withTotal ? { count: "exact" } : undefined)
    .order("stock_number", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(LIVE_LIMIT + excluded.size);
  const { data, error, count } = await applyListRules(select as unknown as IdsQuery, rules, webVisibleOnly);
  if (error) throw new Error(`Could not resolve the live list: ${error.message}`);
  const fetched = (data ?? []).map((r) => r.id);
  const kept = fetched.filter((pid) => !excluded.has(pid));
  const ids = kept.slice(0, LIVE_LIMIT);
  const matched = count ?? fetched.length;
  // Every match was fetched, so `kept` is exact; or nothing is pinned out, so
  // the count is.
  if (!opts.withTotal || matched <= fetched.length) return { ids, total: kept.length };
  if (excluded.size === 0) return { ids, total: matched };
  // More matches than were fetched and some works pinned out: subtract the
  // pinned-out works the rules still match, wherever they fall in the order.
  const pinned = await selectInChunks<{ id: string }>([...excluded], (chunk) =>
    applyListRules(
      supabase.from("vw_pieces_list").select("id").in("id", chunk) as unknown as IdsQuery,
      rules,
      webVisibleOnly,
    ),
  );
  return { ids, total: Math.max(ids.length, matched - pinned.length) };
}

/** A list's size: the works shown (capped as the list page caps them) and the uncapped total. */
export type ListSize = { shown: number; total: number };

/**
 * How many works a list holds. Cheaper than resolving ids for facet-only live
 * lists, which is the common case. Throws on a failed read.
 */
export async function listSize(supabase: SupabaseClient, list: ListLike): Promise<ListSize> {
  if (!list.is_dynamic) {
    // Through the resolver rather than the join table's row count, so a work
    // in the trash is not counted (it is not shown, exported or offered).
    const { ids } = await resolveListMembership(supabase, list);
    return { shown: ids.length, total: ids.length };
  }
  const rules = list.filter_rules ?? {};
  // A text rule or any exclusion means the cheap head-count can't be trusted;
  // resolve properly (an exclusion only subtracts when the rules still match
  // the work, which the resolver gets right and arithmetic here would not).
  const excluded = await listExcludedIds(supabase, list.id);
  if ((rules.q ?? "").trim() || excluded.size > 0) {
    const m = await resolveListMembership(supabase, list);
    return { shown: m.ids.length, total: m.total };
  }
  const head = supabase.from("vw_pieces_list").select("id", { count: "exact", head: true });
  const { count, error } = await applyListRules(head as unknown as CountQuery, rules, false);
  if (error) throw new Error(`Could not count the live list: ${error.message}`);
  // The resolver stops a live list at LIVE_LIMIT works, so the list page never
  // shows more; `shown` stops there too, so the two always agree.
  return { shown: Math.min(count ?? 0, LIVE_LIMIT), total: count ?? 0 };
}

/**
 * The number of works a list shows, for the pickers and indexes that print
 * one count per list (the Library, the offers picker). null when it could not
 * be read, so one failed count shows as a gap rather than taking the page
 * down or passing for an empty list.
 */
export async function countListMembers(
  supabase: SupabaseClient,
  // Callers still select the embedded piece_list_items(count); it is not read
  // any more, because it counts works in the trash too.
  list: ListLike & { piece_list_items?: { count: number }[] },
): Promise<number | null> {
  try {
    return (await listSize(supabase, list)).shown;
  } catch (e) {
    console.error(`[lists] could not count list ${list.id}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
