/*
 * Loaders for the document builders: the SERVICE client (the index holds
 * every record a staff member may read, whoever later searches it), named
 * columns only (documents.ts holds the lists), ids in chunks of 100
 * (lib/chunk.ts) and every select paged by keyset on `id`, so neither the
 * gateway's URL limit, PostgREST's row cap nor a row changing state while
 * the pages are read can silently cut a result short.
 *
 * Every function throws on a database error: the drain then leaves its
 * claims to lapse and the reconcile writes nothing for that kind.
 *
 * Only for server code that has already checked who is asking (the sync
 * route's secret, the cron secret, the Admin role).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/chunk";
import {
  CATEGORY_COLUMNS,
  CONTACT_COLUMNS,
  LEDGER_MOVE_COLUMNS,
  LOCATION_COLUMNS,
  MAKER_COLUMNS,
  ORGANIZATION_COLUMNS,
  PROVENANCE_COLUMNS,
  WORK_COLUMNS,
  WORK_MAKER_COLUMNS,
  type CategoryRow,
  type ContactRow,
  type ContactSource,
  type LedgerMoveRow,
  type LocationRow,
  type MakerRow,
  type OrganizationRow,
  type ProvenanceRow,
  type WorkMakerRow,
  type WorkRow,
  type WorkSource,
} from "./documents";

type Db = SupabaseClient;
type Page<Row> = PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
type Keyed = { id: string };

/** PostgREST's row cap (supabase/config.toml max_rows); a page this full means there may be another. */
const PAGE_ROWS = 1000;
let pageRows = PAGE_ROWS;
/** TEST ONLY: a smaller page, so the paging is exercised with the fixtures; undefined restores it. */
export function setPageRowsForTests(n: number | undefined): void {
  pageRows = n === undefined ? PAGE_ROWS : Math.max(1, Math.trunc(n));
}

/** The query builder calls keyset paging needs (supabase-js's filter builder has them all). */
type KeysetQuery = { gt(column: "id", value: string): KeysetQuery; order(column: "id"): { limit(count: number): unknown } };

/**
 * One page of a query: rows after `after` in id order. Keyset, not offset:
 * with offsets, a row that left the filter while the pages were read (a work
 * trashed, a contact erased) shifted every later page left, one live row was
 * never read, and the reconcile then deleted it from the index.
 */
function keyset<Row>(query: unknown, after: string | null): Page<Row> {
  const q = query as KeysetQuery;
  return (after === null ? q : q.gt("id", after)).order("id").limit(pageRows) as Page<Row>;
}

/** Every row of a query, page by page on the unique `id` (selected by every caller). */
async function allPages<Row extends Keyed>(page: (after: string | null) => Page<Row>): Promise<Row[]> {
  const out: Row[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await page(after);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageRows) return out;
    const last = rows[rows.length - 1]?.id;
    if (typeof last !== "string" || (after !== null && last <= after)) throw new Error("paging made no progress");
    after = last;
  }
}

/** Rows for a list of ids (or of foreign keys), 100 ids per request, each request paged. */
function byIds<Row extends Keyed>(ids: readonly string[], page: (chunk: string[], after: string | null) => Page<Row>): Promise<Row[]> {
  return selectInChunks<Row>(ids, async (chunk) => {
    try {
      return { data: await allPages<Row>((after) => page(chunk, after)), error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  });
}

const cols = (list: readonly string[]) => list.join(", ");
const uniq = (xs: readonly (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => typeof x === "string" && x.length > 0))];

function group<Row, K extends keyof Row>(rows: readonly Row[], key: K): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r[key] as unknown as string;
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ------------------------------------------------------------------ works

/**
 * Works and what their documents need. "all" reads every work outside the
 * trash (the reconcile); a list of ids reads those works whatever their state
 * (the drain: a trashed or purged work then builds no document and is
 * removed). Both registers, through vw_pieces_all.
 */
export async function loadWorkSources(db: Db, ids: readonly string[] | "all"): Promise<Map<string, WorkSource>> {
  const works =
    ids === "all"
      ? await allPages<WorkRow>((after) => keyset(db.from("vw_pieces_all").select(cols(WORK_COLUMNS)).is("deleted_at", null), after))
      : await byIds<WorkRow>(ids, (chunk, after) => keyset(db.from("vw_pieces_all").select(cols(WORK_COLUMNS)).in("id", chunk), after));
  if (works.length === 0) return new Map();
  const workIds = works.map((w) => w.id);
  const [makers, categories, locations, provenance, moves] = await Promise.all([
    byIds<WorkMakerRow>(uniq(works.map((w) => w.maker_id)), (chunk, after) =>
      keyset(db.from("makers").select(cols(WORK_MAKER_COLUMNS)).in("id", chunk), after),
    ),
    byIds<CategoryRow>(uniq(works.map((w) => w.category_id)), (chunk, after) =>
      keyset(db.from("categories").select(cols(CATEGORY_COLUMNS)).in("id", chunk), after),
    ),
    byIds<LocationRow>(uniq(works.map((w) => w.location_id)), (chunk, after) =>
      keyset(db.from("locations").select(cols(LOCATION_COLUMNS)).in("id", chunk), after),
    ),
    ids === "all"
      ? allPages<ProvenanceRow>((after) => keyset(db.from("provenance_entries").select(cols(PROVENANCE_COLUMNS)), after))
      : byIds<ProvenanceRow>(workIds, (chunk, after) =>
          keyset(db.from("provenance_entries").select(cols(PROVENANCE_COLUMNS)).in("piece_id", chunk), after),
        ),
    ids === "all"
      ? allPages<LedgerMoveRow>((after) => keyset(db.from("piece_ledger_moves").select(cols(LEDGER_MOVE_COLUMNS)), after))
      : byIds<LedgerMoveRow>(workIds, (chunk, after) =>
          keyset(db.from("piece_ledger_moves").select(cols(LEDGER_MOVE_COLUMNS)).in("piece_id", chunk), after),
        ),
  ]);
  const makerById = new Map(makers.map((m) => [m.id, m]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const provenanceByWork = group(provenance, "piece_id");
  const movesByWork = group(moves, "piece_id");
  const out = new Map<string, WorkSource>();
  for (const w of works) {
    out.set(w.id, {
      work: w,
      maker: (w.maker_id && makerById.get(w.maker_id)) || null,
      category: (w.category_id && categoryById.get(w.category_id)) || null,
      location: (w.location_id && locationById.get(w.location_id)) || null,
      provenance: provenanceByWork.get(w.id) ?? [],
      moves: movesByWork.get(w.id) ?? [],
    });
  }
  return out;
}

/** The works (outside the trash) of each maker: a renamed maker changes their documents. */
export async function workIdsByMaker(db: Db, makerIds: readonly string[]): Promise<Map<string, string[]>> {
  const rows = await byIds<{ id: string; maker_id: string }>(makerIds, (chunk, after) =>
    keyset(db.from("vw_pieces_all").select("id, maker_id").in("maker_id", chunk).is("deleted_at", null), after),
  );
  return idsBy(rows, "maker_id");
}

/** The works (outside the trash) in each category: a renamed category changes their documents. */
export async function workIdsByCategory(db: Db, categoryIds: readonly string[]): Promise<Map<string, string[]>> {
  const rows = await byIds<{ id: string; category_id: string }>(categoryIds, (chunk, after) =>
    keyset(db.from("vw_pieces_all").select("id, category_id").in("category_id", chunk).is("deleted_at", null), after),
  );
  return idsBy(rows, "category_id");
}

function idsBy<Row extends { id: string }, K extends keyof Row>(rows: readonly Row[], key: K): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [k, list] of group(rows, key)) m.set(k, list.map((r) => r.id));
  return m;
}

// ------------------------------------------------------------------ makers

/** Makers by id, or every maker. */
export async function loadMakerRows(db: Db, ids: readonly string[] | "all"): Promise<Map<string, MakerRow>> {
  const rows =
    ids === "all"
      ? await allPages<MakerRow>((after) => keyset(db.from("makers").select(cols(MAKER_COLUMNS)), after))
      : await byIds<MakerRow>(ids, (chunk, after) => keyset(db.from("makers").select(cols(MAKER_COLUMNS)).in("id", chunk), after));
  return new Map(rows.map((m) => [m.id, m]));
}

// ------------------------------------------------------------------ contacts

/**
 * Contacts and their organisation's name. "all" reads every contact that is
 * not erased (the reconcile); a list of ids reads those contacts whatever
 * their state (an erased one then builds no document and is removed).
 */
export async function loadContactSources(db: Db, ids: readonly string[] | "all"): Promise<Map<string, ContactSource>> {
  const contacts =
    ids === "all"
      ? await allPages<ContactRow>((after) => keyset(db.from("crm_contacts").select(cols(CONTACT_COLUMNS)).is("erased_at", null), after))
      : await byIds<ContactRow>(ids, (chunk, after) => keyset(db.from("crm_contacts").select(cols(CONTACT_COLUMNS)).in("id", chunk), after));
  if (contacts.length === 0) return new Map();
  const orgs = await byIds<OrganizationRow>(uniq(contacts.map((c) => c.organization_id)), (chunk, after) =>
    keyset(db.from("crm_organizations").select(cols(ORGANIZATION_COLUMNS)).in("id", chunk), after),
  );
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  return new Map(
    contacts.map((c) => [c.id, { contact: c, organization: (c.organization_id && orgById.get(c.organization_id)) || null }]),
  );
}

/** The contacts (not erased) of each organisation: a renamed organisation changes their documents. */
export async function contactIdsByOrganization(db: Db, organizationIds: readonly string[]): Promise<Map<string, string[]>> {
  const rows = await byIds<{ id: string; organization_id: string }>(organizationIds, (chunk, after) =>
    keyset(db.from("crm_contacts").select("id, organization_id").in("organization_id", chunk).is("erased_at", null), after),
  );
  return idsBy(rows, "organization_id");
}
