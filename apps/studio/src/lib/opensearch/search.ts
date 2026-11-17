/*
 * The search helpers every call site uses. Server only (the credentials and
 * the Node Buffer live behind it); never import it from a client component
 * or middleware.
 *
 * Contract, for every caller:
 *   - Postgres ALWAYS runs, through the caller's own client, so RLS applies
 *     exactly as today. OpenSearch runs beside it only when configured AND
 *     the roles include admin or staff, and its answer is MERGED in
 *     (merge.ts), never substituted. Unconfigured, down, slow, empty, half
 *     filled or behind, the result is exactly today's.
 *   - The ids come back ranked and de-duplicated but NOT yet checked against
 *     RLS or the trash: load the rows through the same client (works from
 *     vw_pieces_list, never vw_pieces_all, which includes the trash) and keep
 *     the order with inOrder(). Ids that do not load are dropped silently.
 *     Every string shown comes from those rows, never from the index.
 *   - `error` is Postgres's, in supabase-js's shape, so each call site keeps
 *     its error handling without a try/catch.
 *   - `similar: true` means nothing matched exactly and the ids are the
 *     typo-tolerant pass's (only when `fuzzy` was asked for). Postgres cannot
 *     add to a fuzzy result. Say so on screen ("Similar matches").
 *   - `matched` (works only, and only for a size of MATCHED_MAX_SIZE or
 *     less, as the palette asks) maps a work id to the label of the field
 *     that matched ("provenance") when the match was not in the title, maker
 *     or stock number. A label only, never index text; show it only for a
 *     row that loaded.
 *   - Roles are passed in (read once by the route or page): getSession()
 *     is never called here.
 * Timeouts: 600 ms in the palette, 1,500 ms on pages (the caller passes them).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeFilterTerm } from "@/lib/search";
import { searchHits, MAX_HITS, type SearchHit } from "./client";
import { searchConfig, type SearchConfig, type SearchKind } from "./config";
import { mergeIds, mergeWorkIds, type StockRow } from "./merge";
import { buildSearch, matchedLabel } from "./query";

export { inOrder } from "./merge";
export { isSearchable } from "./query";

export type Roles = readonly string[];
export type SearchResult = {
  ids: string[];
  error: { message: string } | null;
  similar: boolean;
  matched?: Record<string, string>;
};

type Db = SupabaseClient;

const DEFAULT_TIMEOUT_MS = 1500;

/** OpenSearch only for these roles: the works index holds provenance and exhibitions, the accountant may not read them. */
function mayUseIndex(roles: Roles): boolean {
  return roles.includes("admin") || roles.includes("staff");
}

const EMPTY: SearchResult = { ids: [], error: null, similar: false };

type Pass = (fuzzy: boolean, timeoutMs: number) => Promise<SearchHit[] | null>;

let testConfig: SearchConfig | null | undefined;
/** TEST ONLY: search a test node and prefix (testSearchConfig) instead of the environment; undefined restores it. */
export function setSearchConfigForTests(cfg: SearchConfig | null | undefined): void {
  testConfig = cfg;
}

function passFor(kind: SearchKind, q: string, size: number, highlight: boolean): Pass | null {
  const cfg = testConfig !== undefined ? testConfig : searchConfig(process.env);
  if (!cfg) return null;
  return async (fuzzy, timeoutMs) => {
    const body = buildSearch(kind, q, { fuzzy, highlight: highlight && !fuzzy });
    if (!body) return null;
    return searchHits(cfg, kind, body, { size, timeoutMs });
  };
}

/**
 * Run the strict pass beside Postgres, merge, and when the merged result is
 * empty and `fuzzy` is set, the fuzzy pass in the time that is left.
 */
async function run<PgRow>(
  postgres: PromiseLike<{ data: PgRow[] | null; error: { message: string } | null }>,
  pass: Pass | null,
  merge: (rows: PgRow[], os: string[] | null) => string[],
  opts: { timeoutMs?: number; fuzzy?: boolean },
): Promise<{ ids: string[]; error: { message: string } | null; similar: boolean; hits: SearchHit[] | null }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();
  const [pg, strict] = await Promise.all([postgres, pass ? pass(false, timeoutMs) : Promise.resolve(null)]);
  if (pg.error) return { ids: [], error: pg.error, similar: false, hits: null };
  const ids = merge(pg.data ?? [], strict ? strict.map((h) => h.id) : null);
  // Fuzzy only when OpenSearch answered (an index that is down or missing will not answer the second pass either).
  if (ids.length > 0 || !opts.fuzzy || !pass || strict === null) return { ids, error: null, similar: false, hits: strict };
  const left = Math.max(150, timeoutMs - (Date.now() - started));
  const loose = await pass(true, left);
  const looseIds = loose ? [...new Set(loose.map((h) => h.id))] : [];
  return { ids: looseIds, error: null, similar: looseIds.length > 0, hits: null };
}

/**
 * Highlights (which name the field behind `matched`) only for a search this
 * small: the palette's 12. At the inventory's 10,000 they multiplied the
 * engine's time five- to eightfold (72-94 ms against 459-739 ms for "Japan"
 * over 5,000 works), and no page that size shows the label.
 */
export const MATCHED_MAX_SIZE = 50;

/**
 * Every work matching `q`, both registers, best first. Every match, not a
 * page: the inventory counts and exports them. `size` bounds OpenSearch's
 * share only (the palette asks for 12; the default is the engine's window,
 * 10,000). `matched` comes only with a size of MATCHED_MAX_SIZE or less.
 */
export async function searchWorkIds(
  supabase: Db,
  q: string,
  opts: { roles: Roles; size?: number; timeoutMs?: number; fuzzy?: boolean },
): Promise<SearchResult> {
  const query = q.trim();
  if (!query) return { ...EMPTY };
  const size = opts.size ?? MAX_HITS;
  const highlight = size <= MATCHED_MAX_SIZE;
  const pass = mayUseIndex(opts.roles) ? passFor("works", query, size, highlight) : null;
  const out = await run<StockRow>(
    supabase.rpc("pieces_search", { q: query }).select("id, stock_number, legacy_stock_number") as unknown as PromiseLike<{
      data: StockRow[] | null;
      error: { message: string } | null;
    }>,
    pass,
    (rows, os) => mergeWorkIds(query, rows, os),
    opts,
  );
  const result: SearchResult = { ids: out.ids, error: out.error, similar: out.similar };
  if (out.hits && highlight) {
    const matched: Record<string, string> = {};
    for (const h of out.hits) {
      const label = matchedLabel(h.fields);
      if (label) matched[h.id] = label;
    }
    if (Object.keys(matched).length) result.matched = matched;
  }
  return result;
}

/**
 * Contacts matching `q`, best first, at most `limit` ids
 * (crm_contacts_search stops at 100 by itself; OpenSearch may add more up to
 * `limit`). Postgres runs for every role (RLS returns nothing to a role
 * without a CRM policy); OpenSearch only for admin and staff.
 */
export async function searchContactIds(
  supabase: Db,
  q: string,
  opts: { roles: Roles; limit: number; timeoutMs?: number; fuzzy?: boolean },
): Promise<SearchResult> {
  const query = q.trim();
  const limit = Math.max(0, Math.trunc(opts.limit));
  if (!query || limit === 0) return { ...EMPTY };
  const pass = mayUseIndex(opts.roles) ? passFor("contacts", query, limit, false) : null;
  const out = await run<{ id: string }>(
    supabase.rpc("crm_contacts_search", { q: query }).select("id") as unknown as PromiseLike<{
      data: { id: string }[] | null;
      error: { message: string } | null;
    }>,
    pass,
    (rows, os) => mergeIds(rows.map((r) => r.id), os),
    opts,
  );
  return { ids: out.ids.slice(0, limit), error: out.error, similar: out.similar };
}

/**
 * Makers matching `q`: Postgres's ILIKE on the makers table (names, region
 * and school, as the makers page searches today, alphabetical), with
 * OpenSearch's folded and fuzzy matches first for admin and staff.
 */
export async function searchMakerIds(
  supabase: Db,
  q: string,
  opts: { roles: Roles; limit: number; timeoutMs?: number; fuzzy?: boolean },
): Promise<SearchResult> {
  const query = q.trim();
  const limit = Math.max(0, Math.trunc(opts.limit));
  const term = sanitizeFilterTerm(query);
  if (!term || limit === 0) return { ...EMPTY };
  const like = `%${term}%`;
  const postgres = supabase
    .from("makers")
    .select("id")
    .or(
      [
        `display_name.ilike.${like}`,
        `native_name.ilike.${like}`,
        `romanized_name.ilike.${like}`,
        `region.ilike.${like}`,
        `school_or_workshop.ilike.${like}`,
      ].join(","),
    )
    .order("display_name")
    .limit(limit) as unknown as PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>;
  const pass = mayUseIndex(opts.roles) ? passFor("makers", query, limit, false) : null;
  const out = await run<{ id: string }>(postgres, pass, (rows, os) => mergeIds(rows.map((r) => r.id), os), opts);
  return { ids: out.ids.slice(0, limit), error: out.error, similar: out.similar };
}
