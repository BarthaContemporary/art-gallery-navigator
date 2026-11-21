import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFacet } from "@/lib/facet";
import { selectInChunks } from "@/lib/chunk";
import { selectAllRows } from "@/lib/paged-read";
import { ledgerFilterOf, resolveListPieceIds, type ListLike } from "@/lib/list-members";
import { inOrder, searchWorkIds, type Roles } from "@/lib/opensearch/search";
/*
 * The inventory list's filters, applied identically wherever they are honoured.
 *
 * The exports used to diverge — CSV and XLSX read only `status` while the DOCX
 * read status, category and location — which meant "export what I'm looking at"
 * quietly wasn't. One function now owns it, and the register filter came along
 * for free. The search, list and flagged filters (resolveInventory) and the
 * sort (inventoryOrder) live here too, for the same reason: the exports read
 * only the facets, so a maker search exported the whole stock.
 *
 * Server only: the text search goes through lib/opensearch/search, which
 * holds the search engine's credentials.
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

/**
 * What the screen shows that a live list saved from it would not: a live
 * list keeps the search, register and facets only (filter_rules), and
 * re-runs the search through lib/list-members, which is pieces_search alone
 * (it feeds the website). So the flag pills, the flagged-only, list and
 * website filters are dropped, and a typo-tolerant ("similar") result is
 * not what the list will hold: it re-runs the exact search, which found
 * nothing. The save form names each, so the list is not quietly wider or
 * emptier than the works on screen.
 */
export function liveListGaps(
  sp: Partial<Record<FlagParam | "flagged" | "list" | "web", string | null | undefined>>,
  { similar = false }: { similar?: boolean } = {},
): string[] {
  return [
    ...activeFlags(sp).map(([, , label]) => label),
    ...(sp.flagged ? ["Flagged only"] : []),
    ...(sp.list ? ["List filter"] : []),
    ...(sp.web === "on" || sp.web === "off" ? ["Website filter"] : []),
    ...(similar ? ["Similar matches (a live list re-runs the exact search)"] : []),
  ];
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

  const ledger = ledgerFilterOf(params.get("ledger"));
  if (ledger) q = q.eq("ledger", ledger);

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

/**
 * pieces.status in the order the piece_status enum declares its values
 * (supabase/migrations/20260713000003_inventory_core.sql), which is how SQL
 * sorts the column. Kept here rather than read from STATUS_LABELS, whose key
 * order is the order of a select's options and may be changed for that.
 */
export const PIECE_STATUS_ORDER = [
  "in_stock",
  "reserved",
  "consigned_in",
  "consigned_out",
  "sold",
  "gifted",
  "returned",
  "written_off",
] as const;
const STATUS_RANK = new Map<string, number>(PIECE_STATUS_ORDER.map((s, i) => [s, i]));

/**
 * One sort key, ascending before `dir`: nulls last either way, as the SQL
 * order asks (nullsFirst: false), and unknown statuses after known ones.
 */
function compareKey(column: string, a: unknown, b: unknown, dir: number): number {
  const av = (a ?? null) as string | number | null;
  const bv = (b ?? null) as string | number | null;
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  if (column === "status") {
    const ra = STATUS_RANK.get(String(av));
    const rb = STATUS_RANK.get(String(bv));
    if (ra !== undefined && rb !== undefined) return dir * (ra - rb);
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
  }
  if (typeof av === "string" && typeof bv === "string") return dir * textOrder.compare(av, bv);
  return av < bv ? -dir : av > bv ? dir : 0;
}

/**
 * The SQL ordering (applyInventoryOrder), in memory: the chosen column in the
 * chosen direction with nulls last, then the stock number in the same
 * direction, then the id, so equal keys always come out the same way.
 * Status follows the enum's order, as SQL sorts it, not the words'.
 */
export function sortInventoryRows<R extends Record<string, unknown>>(rows: R[], order: InventoryOrder): R[] {
  const dir = order.ascending ? 1 : -1;
  return rows.sort(
    (a, b) =>
      compareKey(order.column, a[order.column], b[order.column], dir) ||
      (order.column === "stock_number" ? 0 : compareKey("stock_number", a.stock_number, b.stock_number, dir)) ||
      compareIds(a.id, b.id),
  );
}

/** Ids byte for byte, ascending, as SQL orders a uuid. */
function compareIds(a: unknown, b: unknown): number {
  const as = String(a ?? "");
  const bs = String(b ?? "");
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/** The slice of a PostgREST builder an order needs. */
type OrderQuery<T> = {
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => T;
};

/**
 * Order a vw_pieces_list query the way the screen and the exports do: the
 * chosen column, then the stock number in the same direction, then the id.
 * Most sortable columns repeat (eight statuses over the whole stock), and
 * offset paging over equal keys repeats and skips works between pages
 * unless the order is total; stock_number is unique within a register only,
 * so the id settles "both registers".
 */
export function applyInventoryOrder<T extends OrderQuery<T>>(query: T, by: InventoryOrder): T {
  let q = query.order(by.column, { ascending: by.ascending, nullsFirst: false });
  if (by.column !== "stock_number") q = q.order("stock_number", { ascending: by.ascending });
  return q.order("id");
}

// ------------------------------------------------------------- membership

/** An id plus whichever view columns a query picked (the sort column). */
type ViewRow = { id: string } & Record<string, unknown>;
// A computed select string defeats supabase-js's column parser, so the rows
// are typed by hand, the way lib/piece-store.ts does it.
type ViewResult = { data: ViewRow[] | null; error: { message: string } | null };

/**
 * How long a page's search waits for OpenSearch (lib/opensearch/search: 1,500
 * ms on pages). Postgres's own search is not bounded by it.
 */
const INVENTORY_SEARCH_TIMEOUT_MS = 1500;

/** The works an inventory URL selects, in the screen's order. */
export type InventorySelection = {
  ids: string[];
  /**
   * Nothing matched the search exactly, and these are the typo-tolerant
   * pass's works ("Yosia" finding Yōsai). Only with a search and at least
   * one work left after the filters; the page says so above the table.
   */
  similar: boolean;
};

/**
 * The works an inventory URL selects, in the screen's order, when a plain
 * filtered query cannot express them: a text search, a list (static or live,
 * through the one list resolver) or the current user's flags. Every other
 * filter on the URL (register, facets, the three flag pills, the website
 * facet) is applied on top, in SQL, on vw_pieces_list.
 *
 * The search is lib/opensearch/search's searchWorkIds: Postgres's ranked
 * pieces_search always runs, through this client, and for admin and staff
 * OpenSearch's ids are merged in (and when nothing matches exactly, its
 * typo-tolerant pass answers: `similar`). Those ids are not yet checked
 * against row security or the trash, so every one goes through the view, a
 * chunk at a time with the filters applied, and an id the user may not read
 * or that is in the trash is dropped there. Without OpenSearch (not
 * configured, down, slow, or a role that may not use it) the ids are
 * pieces_search's alone, in its order, as before. Without a chosen column the
 * search's order stands and no tie-break is added; with one, the rows are
 * sorted as SQL sorts them (sortInventoryRows).
 *
 * Returns null when the URL has none of the three, so the caller can count,
 * sort and page in SQL (selectInventoryPage). The inventory page and all
 * three exports call this, which is what makes an export the screen's rows in
 * the screen's order: both pass the session's `roles`.
 *
 * `flaggedIds` saves a query when the caller already holds the user's flags.
 * Throws on a failed query rather than returning a partial set.
 */
export async function resolveInventory(
  // Request-scoped client; RLS scopes piece_flags to the current user.
  supabase: SupabaseClient,
  params: URLSearchParams,
  order: InventoryOrder | null,
  opts: { roles: Roles; flaggedIds?: ReadonlySet<string> },
): Promise<InventorySelection | null> {
  const q = (params.get("q") ?? "").trim();
  const listId = params.get("list");

  // A list id that matches no list leaves the list filter off, as the page
  // always has; a list with no members is a real answer (no rows).
  let members: Set<string> | null = null;
  if (listId) {
    const { data: listRow, error } = await supabase
      .from("piece_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", listId)
      .maybeSingle();
    // A failed read is not "no such list": that would show the whole stock
    // under the list's chip.
    if (error) throw new Error(error.message);
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

  if (q) {
    const found = await searchWorkIds(supabase, q, {
      roles: opts.roles,
      timeoutMs: INVENTORY_SEARCH_TIMEOUT_MS,
      fuzzy: true,
    });
    if (found.error) throw new Error(found.error.message);
    const inList = members;
    const ids = inList ? found.ids.filter((id) => inList.has(id)) : found.ids;
    if (ids.length === 0) return { ids: [], similar: false };

    // The register, the facets, the flag pills, the website facet and the
    // sort column all live on the view, not on the search's ids: resolve the
    // ids through it with every filter applied. Only the columns the order
    // needs come back (the id alone when the search ranks).
    const columns: string = order ? sortColumns(order) : "id";
    const rows = await selectInChunks<ViewRow>(ids, (chunk) =>
      applyInventoryFilters(
        supabase.from("vw_pieces_list").select(columns).in("id", chunk),
        params,
      ) as unknown as PromiseLike<ViewResult>,
    );
    const kept = order ? sortInventoryRows(rows, order) : inOrder(ids, rows);
    return { ids: kept.map((r) => r.id), similar: found.similar && kept.length > 0 };
  }

  // A list or the flags. A single .in() with the whole membership would 414
  // past ~200 ids (lib/chunk.ts), so fetch the members in chunks with the
  // filters applied, then sort here: a list is capped at 500 live (and is
  // rarely more static), so the ids fit comfortably in one pass.
  const by = order ?? SCREEN_ORDER;
  const rows = await selectInChunks<ViewRow>([...(members ?? [])], (chunk) =>
    applyInventoryFilters(
      supabase.from("vw_pieces_list").select(sortColumns(by)).in("id", chunk),
      params,
    ) as unknown as PromiseLike<ViewResult>,
  );
  return { ids: sortInventoryRows(rows, by).map((r) => r.id), similar: false };
}

/** The view columns sortInventoryRows reads for an order: the id, the stock number and the chosen column. */
function sortColumns(order: InventoryOrder): string {
  return order.column === "stock_number" || order.column === "id"
    ? "id, stock_number"
    : `id, stock_number, ${order.column}`;
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
 * them, oldest stock number first otherwise. `roles` are the session's, as
 * the page passes them, so the search merges the same engines the screen
 * did. Every matching row, however many: a search, list or flagged view is
 * read in id chunks, the plain view a page at a time on its total order
 * (column, stock number, id), so a PostgREST row cap cannot cut the file
 * short. Throws on a failed query.
 */
export async function loadInventoryExportRows(
  supabase: SupabaseClient,
  params: URLSearchParams,
  opts: { roles: Roles },
): Promise<Record<string, unknown>[]> {
  const order = inventoryOrder(params, EXPORT_ORDER);
  const picked = await resolveInventory(supabase, params, order, { roles: opts.roles });
  if (picked) return selectInventoryRows<{ id: string } & Record<string, unknown>>(supabase, picked.ids);

  const by = order ?? EXPORT_ORDER;
  // A fresh builder for every page: a supabase-js builder runs once.
  return selectAllRows<Record<string, unknown>>((from, to) =>
    applyInventoryOrder(
      applyInventoryFilters(supabase.from("vw_pieces_list").select("*") as unknown as ViewQuery, params),
      by,
    ).range(from, to),
  );
}

/**
 * One page of the inventory when no search, list or flag filter is on: the
 * URL's filters and order in SQL, with the total. Throws on a failed query.
 *
 * A page past the end (an old link, or a queue that shrank while it was
 * being worked down) is not an error: PostgREST refuses a counted request
 * whose offset is beyond the total (416, PGRST103), so the total is counted
 * on its own and the page comes back empty, which the screen shows as the
 * total alone with the pager to go back by.
 */
export async function selectInventoryPage<Row>(
  supabase: SupabaseClient,
  params: URLSearchParams,
  order: InventoryOrder,
  from: number,
  to: number,
): Promise<{ rows: Row[]; total: number }> {
  const counted = supabase.from("vw_pieces_list").select("*", { count: "exact" }) as unknown as ViewQuery;
  const res = await applyInventoryOrder(applyInventoryFilters(counted, params), order).range(from, to);
  if (!res.error) return { rows: (res.data ?? []) as Row[], total: res.count ?? 0 };
  if (res.status !== 416 && res.error.code !== "PGRST103") throw new Error(res.error.message);
  const head = supabase.from("vw_pieces_list").select("id", { count: "exact", head: true }) as unknown as ViewQuery;
  const { count, error } = await applyInventoryFilters(head, params);
  if (error) throw new Error(error.message);
  return { rows: [], total: count ?? 0 };
}

/**
 * A vw_pieces_list query, typed by hand for the shared filter and order
 * helpers: checking them against the supabase-js builder's own generics
 * sends TypeScript into "type instantiation is excessively deep".
 */
interface ViewQuery
  extends PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: { message: string; code?: string } | null;
    count: number | null;
    status: number;
  }> {
  eq(column: string, value: unknown): ViewQuery;
  neq(column: string, value: string): ViewQuery;
  or(filters: string): ViewQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): ViewQuery;
  range(from: number, to: number): ViewQuery;
}
