/*
 * Contact searches outside the palette: the contacts page, the add box on a
 * contact list, and /api/crm/contacts/search (the buyer and consignee
 * pickers). Server only: it goes through lib/opensearch/search.ts, which
 * holds the engine's credentials.
 *
 * Each asks searchContactIds for ranked ids (crm_contacts_search always;
 * the contacts index merged in for admin and staff; the typo-tolerant pass
 * when nothing matched exactly), takes out the ids the caller excludes, and
 * loads the rows from crm_contacts through the caller's own client, so row
 * level security decides what is shown and every string comes from those
 * rows. Ids that do not load (erased or deleted since they were indexed) are
 * dropped. With the index unconfigured, down or behind, the result is
 * crm_contacts_search's, as before the engine existed.
 *
 * Errors are returned, never thrown, so each caller keeps its own handling
 * (selectContactsPage, the browsing query, throws as selectInventoryPage
 * does).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/chunk";
import { inOrder, isSearchable, searchContactIds, type Roles } from "@/lib/opensearch/search";

type Db = SupabaseClient;
type DbError = { message: string; code?: string };

/**
 * crm_contacts_search's own `limit 100`. A result this long may have been
 * cut by it; only the contacts index can take a search past it.
 */
export const POSTGRES_CONTACT_LIMIT = 100;

/** The contacts page's search: as many as the merged search can give. */
export const CONTACTS_PAGE_LIMIT = 200;
/** The add box on a contact list: ids asked for, and rows shown once the members are taken out. */
export const LIST_ADD_ASK = 100;
export const LIST_ADD_SHOW = 20;
/** The pickers (/api/crm/contacts/search): rows shown, and ids asked for (a margin for ids that do not load). */
export const PICKER_SHOW = 10;
export const PICKER_ASK = 20;

export type FoundContacts<Row> = {
  rows: Row[];
  /** The rows are the typo-tolerant pass's: say "Similar matches" over them. */
  similar: boolean;
  /** How many ids the search returned, before exclusions and before loading. */
  found: number;
  /** The search's or the row load's error; rows are then empty. */
  error: DbError | null;
};

export type FindOptions = {
  /** From the session the caller already read (getSession is not called here). */
  roles: Roles;
  /** crm_contacts columns to load; must include id. */
  columns: string;
  /** Ids to ask the search for. */
  limit: number;
  /** Rows to keep, after exclusions; all of them when left out. */
  show?: number;
  /** Ids never offered (a list's members). */
  exclude?: ReadonlySet<string>;
  timeoutMs?: number;
};

export async function findContacts<Row extends { id: string }>(
  db: Db,
  q: string,
  opts: FindOptions,
): Promise<FoundContacts<Row>> {
  const none = (error: DbError | null, found = 0): FoundContacts<Row> => ({ rows: [], similar: false, found, error });
  // Any term, as the pages searched before the index existed (one letter
  // included: the engine leaves out what isSearchable refuses, Postgres
  // still answers). The pickers' route applies the two-character rule.
  const term = q.trim();
  if (!term) return none(null);
  const search = await searchContactIds(db, term, {
    roles: opts.roles,
    limit: opts.limit,
    timeoutMs: opts.timeoutMs ?? 1500,
    fuzzy: true,
  });
  if (search.error) return none(search.error);
  const exclude = opts.exclude ?? new Set<string>();
  const ids = search.ids.filter((id) => !exclude.has(id));
  let loaded: Row[];
  try {
    loaded = await selectInChunks<Row>(
      ids,
      (chunk) =>
        db.from("crm_contacts").select(opts.columns).in("id", chunk) as unknown as PromiseLike<{
          data: Row[] | null;
          error: DbError | null;
        }>,
    );
  } catch (err) {
    return none({ message: err instanceof Error ? err.message : String(err) }, search.ids.length);
  }
  const ordered = inOrder(ids, loaded);
  const rows = opts.show === undefined ? ordered : ordered.slice(0, opts.show);
  return { rows, similar: search.similar && rows.length > 0, found: search.ids.length, error: null };
}

/**
 * Whether a search may have stopped short: it reached Postgres's own limit
 * (only the index goes past it) or the limit asked for.
 */
export function mayHaveMore(found: number, limit: number): boolean {
  return found >= Math.min(POSTGRES_CONTACT_LIMIT, limit);
}

/**
 * One page of the contacts list (no search), with the total, in name order
 * with the id as the last tie-break so pages never overlap. Throws on a
 * failed query.
 *
 * A page past the end (an old link after contacts were deleted) is not an
 * error: PostgREST refuses a counted request whose offset is beyond the
 * total (416, PGRST103), so the total is counted on its own and the page
 * comes back empty, as selectInventoryPage does; the page then sends the
 * reader to the last page.
 */
export async function selectContactsPage<Row>(
  db: Db,
  columns: string,
  page: number,
  pageSize: number,
): Promise<{ rows: Row[]; total: number }> {
  const from = (page - 1) * pageSize;
  const res = (await db
    .from("crm_contacts")
    .select(columns, { count: "exact" })
    .order("last_name", { nullsFirst: false })
    .order("first_name", { nullsFirst: false })
    .order("id")
    .range(from, from + pageSize - 1)) as unknown as {
    data: Row[] | null;
    error: DbError | null;
    count: number | null;
    status: number;
  };
  if (!res.error) return { rows: res.data ?? [], total: res.count ?? 0 };
  if (res.status !== 416 && res.error.code !== "PGRST103") throw new Error(res.error.message);
  const head = await db.from("crm_contacts").select("id", { count: "exact", head: true });
  if (head.error) throw new Error(head.error.message);
  return { rows: [], total: head.count ?? 0 };
}

// ------------------------------------------------------------------ the pickers' route

export type ContactHit = { id: string; name: string; email: string | null };
type PickerRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

const mayUseCrm = (roles: Roles) => roles.includes("admin") || roles.includes("staff");

/**
 * GET /api/crm/contacts/search after the session check: { results } as the
 * buyer picker and the consignment panel read it (plus `similar`), 403 for a
 * role with no CRM access (no query is made), 500 with the error when the
 * search fails.
 */
export async function contactPickerSearch(
  db: Db,
  raw: string | null | undefined,
  roles: Roles,
): Promise<{ status: number; body: { results: ContactHit[]; similar: boolean } | { error: string } }> {
  if (!mayUseCrm(roles)) return { status: 403, body: { error: "Forbidden" } };
  const q = String(raw ?? "").trim();
  if (!isSearchable(q)) return { status: 200, body: { results: [], similar: false } };
  const out = await findContacts<PickerRow>(db, q, {
    roles,
    columns: "id, first_name, last_name, email",
    limit: PICKER_ASK,
    show: PICKER_SHOW,
    // As you type, as in the palette.
    timeoutMs: 600,
  });
  if (out.error) return { status: 500, body: { error: out.error.message } };
  const results = out.rows.map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed",
    email: c.email ?? null,
  }));
  return { status: 200, body: { results, similar: out.similar } };
}
