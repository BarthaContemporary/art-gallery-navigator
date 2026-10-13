import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFacet, facetMatches } from "@/lib/facet";
import { selectInChunks } from "@/lib/chunk";
import { resolveListPieceIds, type ListLike } from "@/lib/list-members";
/*
 * The inventory list's filters, applied identically wherever they are honoured.
 *
 * The exports used to diverge — CSV and XLSX read only `status` while the DOCX
 * read status, category and location — which meant "export what I'm looking at"
 * quietly wasn't. One function now owns it, and the register filter came along
 * for free. The search, list and flagged filters (resolveInventoryIds) and the
 * sort (inventoryOrder) live here too, for the same reason: the exports read
 * only the facets, so a maker search exported the whole stock.
 */

/** Columns every export shares, in the order they read best. */
export const EXPORT_COLUMNS = [
  "stock_number",
  "legacy_stock_number",
  "title",
  "maker_name",
  "category_name",
  "medium",
  "period",
  "origin_region",
  "status",
  "location_code",
  "register",
] as const;

/** Human label for the register column; the raw enum would not read well. */
export function registerLabel(ledger: unknown): string {
  return ledger === "external" ? "Not JvdB" : "JvdB";
}

/**
 * Boolean "show only…" filters: URL param → vw_pieces_list column → pill
 * label. One table so the query branches, the exports and the pills can
 * never disagree about which flags exist.
 */
export const FLAG_FILTERS = [
  ["loan", "on_temp_export", "On temporary export"],
  ["needs", "needs_completion", "Needs completion"],
  ["nopurchase", "missing_purchase_gbp", "Needs purchase £"],
] as const;

export type FlagParam = (typeof FLAG_FILTERS)[number][0];

export function activeFlags(sp: Partial<Record<FlagParam, string | null | undefined>>) {
  return FLAG_FILTERS.filter(([param]) => Boolean(sp[param]));
}

// The constraint deliberately doesn't name T as eq's return type: a
// self-referential bound sends TypeScript into Supabase's builder generics
// ("type instantiation is excessively deep") at some call sites.
export function applyFlagFilters<T extends { eq: (column: string, value: unknown) => unknown }>(
  query: T,
  sp: Partial<Record<FlagParam, string | null | undefined>>,
): T {
  let q = query;
  for (const [, column] of activeFlags(sp)) q = q.eq(column, true) as T;
  return q;
}

/**
 * The "On website" facet: `web=on` keeps the works shown on the website,
 * `web=off` the works that are not, anything else both. pieces.web_visible is
 * not null, so the two answers split the stock with nothing left over.
 */
export function webFilterOf(raw: string | null | undefined): boolean | null {
  return raw === "on" ? true : raw === "off" ? false : null;
}

export function applyWebFilter<T extends { eq: (column: string, value: unknown) => unknown }>(
  query: T,
  raw: string | null | undefined,
): T {
  const want = webFilterOf(raw);
  return want === null ? query : (query.eq("web_visible", want) as T);
}

/**
 * Apply the inventory URL's filters to a `vw_pieces_list` query.
 *
 * The register default matches the list itself: JvdB stock unless asked
 * otherwise, so an export taken without touching the filter never quietly
 * includes works the gallery does not own.
 */
export function applyInventoryFilters<
  T extends {
    eq: (column: string, value: unknown) => T;
    neq: (column: string, value: string) => T;
    or: (filters: string) => T;
  },
>(query: T, params: URLSearchParams): T {
  let q = query;
  for (const [param, column, nullable] of [
    ["status", "status", false],
    ["category", "category_id", true],
    ["location", "location_id", true],
  ] as const) {
    q = applyFacet(q, column, params.get(param), { nullable });
  }
  q = applyFlagFilters(q, {
    loan: params.get("loan"),
    needs: params.get("needs"),
    nopurchase: params.get("nopurchase"),
  });
  q = applyWebFilter(q, params.get("web"));

  const ledger = params.get("ledger");
  if (ledger !== "all") q = q.eq("ledger", ledger === "external" ? "external" : "jvb");

  return q;
}

/** Row shaped for export: the view's columns plus a readable register label. */
export function toExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, register: registerLabel(row.ledger) };
}

// ------------------------------------------------------------------ order

/** Columns the table header may sort by: the URL's `sort` → vw_pieces_list column. */
export const INVENTORY_SORTABLE: Record<string, string> = {
  stock_number: "stock_number",
  title: "title",
  maker_name: "maker_name",
  category_name: "category_name",
  location_code: "location_code",
  status: "status",
};

export type InventoryOrder = { column: string; ascending: boolean };

/** The screen's order when none is chosen: newest stock number first. */
export const SCREEN_ORDER: InventoryOrder = { column: "stock_number", ascending: false };
/**
 * The exports' order when none is chosen: oldest stock number first, as they
 * have always read, so an export taken without touching anything is unchanged.
 */
export const EXPORT_ORDER: InventoryOrder = { column: "stock_number", ascending: true };

/**
 * The order an inventory URL asks for. A column picked in the table header
 * (`sort`, with `dir`) wins everywhere, a text search included: the header
 * shows it as active, so ignoring it while searching was a lie. Without one a
 * search keeps its relevance ranking (null), and anything else falls back to
 * `fallback`, with `dir` alone still flipping it as it always has on screen.
 */
export function inventoryOrder(
  params: URLSearchParams,
  fallback: InventoryOrder,
): InventoryOrder | null {
  const chosen = INVENTORY_SORTABLE[params.get("sort") ?? ""];
  if (!chosen && (params.get("q") ?? "").trim()) return null;
  const dir = params.get("dir");
  return { column: chosen ?? fallback.column, ascending: dir ? dir === "asc" : fallback.ascending };
}

/**
 * Text compares as people read it, close to the database's own collation:
 * case and accents aside, and digits as numbers. A plain `<` put "Zenzo"
 * before "akiyama" and accented names after Z, so a search or list sorted
 * differently from the plain view, and so did its export.
 */
const textOrder = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

/** The SQL ordering, in memory: chosen column, chosen direction, nulls last. */
function sortRows<R extends Record<string, unknown>>(rows: R[], order: InventoryOrder): R[] {
  const dir = order.ascending ? 1 : -1;
  return rows.sort((a, b) => {
    const av = (a[order.column] ?? null) as string | number | null;
    const bv = (b[order.column] ?? null) as string | number | null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "string" && typeof bv === "string") return dir * textOrder.compare(av, bv);
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}

// ------------------------------------------------------------- membership

function flagParams(params: URLSearchParams): Record<FlagParam, string | null> {
  return { loan: params.get("loan"), needs: params.get("needs"), nopurchase: params.get("nopurchase") };
}

/** An id plus whichever view columns a query picked (the sort column). */
type ViewRow = { id: string } & Record<string, unknown>;
// A computed select string defeats supabase-js's column parser, so the rows
// are typed by hand, the way lib/piece-store.ts does it.
type ViewResult = { data: ViewRow[] | null; error: { message: string } | null };

type SearchHit = {
  id: string;
  status: string;
  category_id: string | null;
  location_id: string | null;
  ledger: string;
};

/**
 * The works an inventory URL selects, in the screen's order, when a plain
 * filtered query cannot express them: a text search (the ranked
 * pieces_search RPC), a list (static or live, through the one list resolver)
 * or the current user's flags. Every other filter on the URL (register,
 * facets, the three flag pills, the website facet) is applied on top.
 *
 * Returns null when the URL has none of the three, so the caller can count,
 * sort and page in SQL with applyInventoryFilters. The inventory page and all
 * three exports call this, which is what makes an export the screen's rows in
 * the screen's order.
 *
 * `flaggedIds` saves a query when the caller already holds the user's flags.
 * Throws on a failed query rather than returning a partial set.
 */
export async function resolveInventoryIds(
  // Request-scoped client; RLS scopes piece_flags to the current user.
  supabase: SupabaseClient,
  params: URLSearchParams,
  order: InventoryOrder | null,
  opts: { flaggedIds?: ReadonlySet<string> } = {},
): Promise<string[] | null> {
  const q = (params.get("q") ?? "").trim();
  const listId = params.get("list");

  // A list id that matches no list leaves the list filter off, as the page
  // always has; a list with no members is a real answer (no rows).
  let members: Set<string> | null = null;
  if (listId) {
    const { data: listRow } = await supabase
      .from("piece_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", listId)
      .maybeSingle();
    if (listRow) members = new Set(await resolveListPieceIds(supabase, listRow as ListLike));
  }
  // "Flagged only" narrows to the user's flags, on top of a list if one is
  // active. An empty set is a real answer too: nothing flagged, no rows.
  if (params.get("flagged")) {
    let mine = opts.flaggedIds;
    if (!mine) {
      const { data, error } = await supabase.from("piece_flags").select("piece_id");
      if (error) throw new Error(error.message);
      mine = new Set(((data ?? []) as { piece_id: string }[]).map((f) => f.piece_id));
    }
    const inList = members;
    members = new Set(inList ? [...mine].filter((id) => inList.has(id)) : mine);
  }
  if (!q && !members) return null;

  const flags = flagParams(params);

  if (q) {
    // The RPC has no facet parameters, so the register and facets are applied
    // to the ranked hits here, which keeps the relevance order.
    const { data: hits, error } = await supabase.rpc("pieces_search", { q });
    if (error) throw new Error(error.message);
    const ledger = params.get("ledger");
    const wantLedger = ledger === "all" ? null : ledger === "external" ? "external" : "jvb";
    let filtered = (hits ?? []) as SearchHit[];
    if (wantLedger) filtered = filtered.filter((h) => h.ledger === wantLedger);
    for (const [param, key] of [
      ["status", "status"],
      ["category", "category_id"],
      ["location", "location_id"],
    ] as const) {
      const raw = params.get(param);
      if (raw) filtered = filtered.filter((h) => facetMatches(raw, h[key]));
    }
    if (members) {
      const inList = members;
      filtered = filtered.filter((h) => inList.has(h.id));
    }
    const ids = filtered.map((h) => h.id);
    const web = params.get("web");
    if (ids.length === 0 || (!order && activeFlags(flags).length === 0 && webFilterOf(web) === null)) return ids;

    // The flag and website columns, and most sort columns, live on the view
    // rather than on the hits, so resolve them through the view for the
    // matching ids only.
    const columns: string = order ? `id, ${order.column}` : "id";
    const rows = await selectInChunks<ViewRow>(ids, (chunk) =>
      applyWebFilter(
        applyFlagFilters(supabase.from("vw_pieces_list").select(columns).in("id", chunk), flags),
        web,
      ) as unknown as PromiseLike<ViewResult>,
    );
    if (order) return sortRows(rows, order).map((r) => r.id);
    const keep = new Set(rows.map((r) => r.id));
    return ids.filter((id) => keep.has(id));
  }

  // A list or the flags. A single .in() with the whole membership would 414
  // past ~200 ids (lib/chunk.ts), so fetch the members in chunks with the
  // filters applied, then sort here: a list is capped at 500 live (and is
  // rarely more static), so the ids fit comfortably in one pass.
  const by = order ?? SCREEN_ORDER;
  const columns: string = `id, ${by.column}`;
  const rows = await selectInChunks<ViewRow>([...(members ?? [])], (chunk) =>
    applyInventoryFilters(
      supabase.from("vw_pieces_list").select(columns).in("id", chunk),
      params,
    ) as unknown as PromiseLike<ViewResult>,
  );
  return sortRows(rows, by).map((r) => r.id);
}

/**
 * vw_pieces_list rows for `ids`, in the order given, fetched in chunks. Ids
 * that no longer resolve (trashed since) are simply absent.
 */
export async function selectInventoryRows<Row extends { id: string }>(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<Row[]> {
  const fetched = await selectInChunks<Row>(ids, (chunk) =>
    supabase.from("vw_pieces_list").select("*").in("id", chunk),
  );
  const byId = new Map(fetched.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
}

/**
 * Every row an export of this inventory URL contains: the screen's rows
 * (search, list, flagged, register, facets, flag pills and website all
 * honoured) in the screen's order when a sort is chosen or a search ranks
 * them, oldest stock number first otherwise. Throws on a failed query.
 */
export async function loadInventoryExportRows(
  supabase: SupabaseClient,
  params: URLSearchParams,
): Promise<Record<string, unknown>[]> {
  const order = inventoryOrder(params, EXPORT_ORDER);
  const ids = await resolveInventoryIds(supabase, params, order);
  if (ids) return selectInventoryRows<{ id: string } & Record<string, unknown>>(supabase, ids);

  const by = order ?? EXPORT_ORDER;
  const { data, error } = await applyInventoryFilters(
    supabase
      .from("vw_pieces_list")
      .select("*")
      .order(by.column, { ascending: by.ascending, nullsFirst: false }),
    params,
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
