/*
 * The ⌘K palette's search: everything GET /api/search answers once the route
 * has read the session and its roles. Server only (it goes through
 * lib/opensearch/search.ts, which holds the engine's credentials); the
 * palette imports its types only.
 *
 * Four groups, searched side by side. A group that fails comes back empty
 * and is named in `failed`; it never empties another group.
 *   pieces    searchWorkIds (12 ids from each of Postgres and the engine,
 *             600 ms, the typo-tolerant pass when nothing matched exactly),
 *             rows from vw_pieces_list (never vw_pieces_all, which includes
 *             the trash), the first 6 that load, each with the label of the
 *             field that matched when the match was not in what the row
 *             shows ("provenance").
 *   makers    searchMakerIds (4), rows from makers.
 *   contacts  admin and staff only: the accountant has no policy on any CRM
 *             table, and nothing is asked of Postgres or OpenSearch for
 *             them. searchContactIds (12), rows from crm_contacts, the
 *             first 6 that load.
 *   records   a query of 3 or more characters: one ILIKE per table, 3 rows
 *             each, only on the tables the user's roles have a policy on
 *             (offers, piece lists, contact lists and newsletters: admin and
 *             staff; documents and shipments: the accountant as well). Row
 *             level security does the rest: staff never see invoices among
 *             the documents, and the accountant sees nothing else.
 * Every query goes through the caller's own client, so RLS applies, and
 * every string returned comes from those rows, never from the index.
 *
 * With OpenSearch unconfigured, down or slow, each group is what Postgres
 * finds, as before the engine existed (search.ts's contract).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeFilterTerm } from "@/lib/search";
import { DOC_TYPE_LABELS, OFFER_KIND_LABELS, SHIPMENT_KIND_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import {
  inOrder,
  isSearchable,
  searchContactIds,
  searchMakerIds,
  searchWorkIds,
  type Roles,
} from "@/lib/opensearch/search";

type Db = SupabaseClient;
type DbError = { message: string; code?: string };
type Rows<Row> = PromiseLike<{ data: Row[] | null; error: DbError | null }>;

/** How much each group asks for and shows. */
export const PALETTE = {
  /**
   * Work ids asked of each side, the engine and Postgres (pieces_search's own
   * order, so its exact and contained stock numbers stay first): ids that do
   * not load are skipped.
   */
  workIds: 12,
  works: 6,
  makers: 4,
  contactIds: 12,
  contacts: 6,
  /** Rows per record table. */
  records: 3,
  /** Records only from this many characters: a two-letter ILIKE over six tables matches everything. */
  recordsMinChars: 3,
  timeoutMs: 600,
  /** Longer queries are cut (the engine cuts at the same length). */
  maxChars: 200,
} as const;

export type PaletteGroup = "pieces" | "makers" | "contacts" | "records";

export type PalettePiece = {
  id: string;
  stock_number: string;
  title: string | null;
  maker_name: string | null;
  status: string | null;
  /** The field the match was in, when the row does not show it ("provenance"); a label, never index text. */
  matched: string | null;
};
export type PaletteMaker = { id: string; name: string; detail: string | null };
export type PaletteContact = { id: string; name: string; email: string | null };
export type RecordType = "offer" | "document" | "shipment" | "piece_list" | "crm_list" | "campaign";
export type PaletteRecord = { type: RecordType; id: string; href: string; title: string; detail: string };

export type PaletteResponse = {
  pieces: PalettePiece[];
  makers: PaletteMaker[];
  contacts: PaletteContact[];
  records: PaletteRecord[];
  /** Per group: the rows are the typo-tolerant pass's ("Similar matches"). */
  similar: { pieces: boolean; makers: boolean; contacts: boolean };
  /** Groups whose search failed: shown as such, not as "no matches". */
  failed: PaletteGroup[];
};

export function emptyPalette(): PaletteResponse {
  return {
    pieces: [],
    makers: [],
    contacts: [],
    records: [],
    similar: { pieces: false, makers: false, contacts: false },
    failed: [],
  };
}

const hasAny = (roles: Roles, wanted: readonly string[]) => wanted.some((r) => roles.includes(r));
const CRM_ROLES = ["admin", "staff"] as const;

/** A failed query: thrown inside a group, caught by group(). Only the code is logged (messages can quote the query). */
class GroupError extends Error {
  readonly dbError: DbError;
  constructor(dbError: DbError) {
    super(dbError.message);
    this.dbError = dbError;
  }
}
function check<T>(res: { data: T[] | null; error: DbError | null }): T[] {
  if (res.error) throw new GroupError(res.error);
  return res.data ?? [];
}

async function group<T>(name: PaletteGroup, failed: Set<PaletteGroup>, empty: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    failed.add(name);
    const code = err instanceof GroupError ? err.dbError.code : err instanceof Error ? err.name : undefined;
    console.error(`[search] palette ${name} failed${code ? ` (${code})` : ""}`);
    return empty;
  }
}

// ------------------------------------------------------------------ works

const WORK_COLUMNS = "id, stock_number, title, maker_name, status";
type WorkRow = Omit<PalettePiece, "matched">;

async function works(db: Db, q: string, roles: Roles): Promise<{ rows: PalettePiece[]; similar: boolean }> {
  // postgresLimit: twelve rows from pieces_search, not one for every matching
  // work (thousands for a two-letter query), as the palette asked before the engine.
  const found = await searchWorkIds(db, q, {
    roles,
    size: PALETTE.workIds,
    postgresLimit: PALETTE.workIds,
    timeoutMs: PALETTE.timeoutMs,
    fuzzy: true,
  });
  if (found.error) throw new GroupError(found.error);
  const ids = found.ids.slice(0, PALETTE.workIds);
  if (ids.length === 0) return { rows: [], similar: false };
  const loaded = check(await (db.from("vw_pieces_list").select(WORK_COLUMNS).in("id", ids) as unknown as Rows<WorkRow>));
  const rows = inOrder(ids, loaded)
    .slice(0, PALETTE.works)
    .map((p) => ({ ...p, matched: found.matched?.[p.id] ?? null }));
  return { rows, similar: found.similar && rows.length > 0 };
}

// ------------------------------------------------------------------ makers

type MakerRow = {
  id: string;
  display_name: string | null;
  native_name: string | null;
  life_dates: string | null;
  region: string | null;
};

async function makers(db: Db, q: string, roles: Roles): Promise<{ rows: PaletteMaker[]; similar: boolean }> {
  const found = await searchMakerIds(db, q, { roles, limit: PALETTE.makers, timeoutMs: PALETTE.timeoutMs, fuzzy: true });
  if (found.error) throw new GroupError(found.error);
  if (found.ids.length === 0) return { rows: [], similar: false };
  const loaded = check(
    await (db
      .from("makers")
      .select("id, display_name, native_name, life_dates, region")
      .in("id", found.ids) as unknown as Rows<MakerRow>),
  );
  const rows = inOrder(found.ids, loaded).map((m) => ({
    id: m.id,
    name: m.display_name?.trim() || m.native_name?.trim() || "Unnamed maker",
    detail: [m.display_name?.trim() ? m.native_name : null, m.life_dates, m.region].filter(Boolean).join(" · ") || null,
  }));
  return { rows, similar: found.similar && rows.length > 0 };
}

// ------------------------------------------------------------------ contacts

type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null };

export function contactName(c: { first_name: string | null; last_name: string | null; email: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
}

async function contacts(db: Db, q: string, roles: Roles): Promise<{ rows: PaletteContact[]; similar: boolean }> {
  const found = await searchContactIds(db, q, {
    roles,
    limit: PALETTE.contactIds,
    timeoutMs: PALETTE.timeoutMs,
    fuzzy: true,
  });
  if (found.error) throw new GroupError(found.error);
  if (found.ids.length === 0) return { rows: [], similar: false };
  const loaded = check(
    await (db
      .from("crm_contacts")
      .select("id, first_name, last_name, email")
      .in("id", found.ids) as unknown as Rows<ContactRow>),
  );
  const rows = inOrder(found.ids, loaded)
    .slice(0, PALETTE.contacts)
    .map((c) => ({ id: c.id, name: contactName(c), email: c.email ?? null }));
  return { rows, similar: found.similar && rows.length > 0 };
}

// ------------------------------------------------------------------ records

type RecordRow = Record<string, unknown> & { id: string };
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const joined = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

type RecordSource = {
  type: RecordType;
  table: string;
  /** Roles with a SELECT policy on the table (supabase/migrations: 20260713000012_rls, 20260713000028, 20260713000034). */
  roles: readonly string[];
  columns: string;
  /** The columns the term is looked for in. */
  match: readonly string[];
  /** Newest first. */
  order: string;
  href: (id: string) => string;
  show: (r: RecordRow) => { title: string; detail: string };
};

export const RECORD_SOURCES: readonly RecordSource[] = [
  {
    type: "offer",
    table: "offers",
    roles: CRM_ROLES,
    columns: "id, title, kind",
    match: ["title"],
    order: "updated_at",
    href: (id) => `/offers/${id}`,
    show: (r) => ({ title: text(r.title) ?? "Untitled offer", detail: OFFER_KIND_LABELS[String(r.kind)] ?? "Offer" }),
  },
  {
    type: "document",
    table: "piece_documents",
    roles: ["admin", "staff", "accountant"],
    columns: "id, title, doc_type, reference",
    match: ["title", "reference"],
    order: "created_at",
    href: (id) => `/documents/${id}`,
    show: (r) => {
      const kind = DOC_TYPE_LABELS[String(r.doc_type)] ?? "Other";
      const title = text(r.title);
      return {
        title: title ?? text(r.reference) ?? kind,
        detail: joined(`Document · ${kind}`, title ? text(r.reference) : null),
      };
    },
  },
  {
    type: "shipment",
    table: "shipments",
    roles: ["admin", "staff", "accountant"],
    columns: "id, kind, reference, shipment_date",
    match: ["reference"],
    order: "updated_at",
    href: (id) => `/shipments/${id}`,
    show: (r) => {
      const kind = SHIPMENT_KIND_LABELS[String(r.kind)] ?? "Shipment";
      return {
        title: text(r.reference) ?? kind,
        detail: joined(`Shipment · ${kind}`, r.shipment_date ? formatDate(r.shipment_date as string) : null),
      };
    },
  },
  {
    type: "piece_list",
    table: "piece_lists",
    roles: CRM_ROLES,
    columns: "id, name",
    match: ["name"],
    order: "updated_at",
    href: (id) => `/inventory/lists/${id}`,
    show: (r) => ({ title: text(r.name) ?? "Untitled list", detail: "Inventory list" }),
  },
  {
    type: "crm_list",
    table: "crm_lists",
    roles: CRM_ROLES,
    columns: "id, name",
    match: ["name"],
    order: "updated_at",
    href: (id) => `/crm/lists/${id}`,
    show: (r) => ({ title: text(r.name) ?? "Untitled list", detail: "Contact list" }),
  },
  {
    type: "campaign",
    table: "crm_campaigns",
    roles: CRM_ROLES,
    columns: "id, name, subject",
    match: ["name", "subject"],
    order: "updated_at",
    href: (id) => `/crm/campaigns/${id}`,
    show: (r) => {
      const name = text(r.name);
      const subject = text(r.subject);
      return { title: name ?? subject ?? "Untitled newsletter", detail: joined("Newsletter", name && subject !== name ? subject : null) };
    },
  },
];

/** The record tables these roles have a policy on. */
export function recordSourcesFor(roles: Roles): RecordSource[] {
  return RECORD_SOURCES.filter((s) => hasAny(roles, s.roles));
}

async function recordsFrom(db: Db, src: RecordSource, term: string): Promise<PaletteRecord[]> {
  const like = `%${term}%`;
  const base = db.from(src.table).select(src.columns);
  const filtered = src.match.length === 1 ? base.ilike(src.match[0]!, like) : base.or(src.match.map((c) => `${c}.ilike.${like}`).join(","));
  const rows = check(
    await (filtered.order(src.order, { ascending: false }).limit(PALETTE.records) as unknown as Rows<RecordRow>),
  );
  return rows.map((r) => ({ type: src.type, id: r.id, href: src.href(r.id), ...src.show(r) }));
}

/**
 * Records matching the term, table by table in RECORD_SOURCES order. A table
 * that fails is left out and the group is reported failed; the other tables
 * still answer.
 */
async function records(db: Db, q: string, roles: Roles): Promise<{ rows: PaletteRecord[]; partial: boolean }> {
  const term = sanitizeFilterTerm(q);
  if ([...term].length < PALETTE.recordsMinChars) return { rows: [], partial: false };
  const settled = await Promise.allSettled(recordSourcesFor(roles).map((src) => recordsFrom(db, src, term)));
  const rows: PaletteRecord[] = [];
  let partial = false;
  for (const s of settled) {
    if (s.status === "fulfilled") rows.push(...s.value);
    else partial = true;
  }
  if (partial && rows.length === 0) throw settled.find((s) => s.status === "rejected")!.reason;
  if (partial) console.error("[search] palette records: a table failed");
  return { rows, partial };
}

// ------------------------------------------------------------------ the answer

/** The query as searched: trimmed and cut at PALETTE.maxChars characters. */
export function paletteQuery(raw: string | null | undefined): string {
  return [...String(raw ?? "").trim()].slice(0, PALETTE.maxChars).join("").trim();
}

/**
 * The palette's answer for `raw`, for a user with `roles` (read once by the
 * route). Never throws: a group that fails is empty and named in `failed`.
 * Too short a query (isSearchable) answers empty without a query.
 */
export async function paletteSearch(db: Db, raw: string | null | undefined, roles: Roles): Promise<PaletteResponse> {
  const out = emptyPalette();
  const q = paletteQuery(raw);
  if (!isSearchable(q)) return out;
  const failed = new Set<PaletteGroup>();
  const none = { rows: [], similar: false };
  const [w, m, c, r] = await Promise.all([
    group("pieces", failed, none as { rows: PalettePiece[]; similar: boolean }, () => works(db, q, roles)),
    group("makers", failed, none as { rows: PaletteMaker[]; similar: boolean }, () => makers(db, q, roles)),
    hasAny(roles, CRM_ROLES)
      ? group("contacts", failed, none as { rows: PaletteContact[]; similar: boolean }, () => contacts(db, q, roles))
      : Promise.resolve(none as { rows: PaletteContact[]; similar: boolean }),
    group("records", failed, { rows: [] as PaletteRecord[], partial: false }, () => records(db, q, roles)),
  ]);
  if (r.partial) failed.add("records");
  out.pieces = w.rows;
  out.makers = m.rows;
  out.contacts = c.rows;
  out.records = r.rows;
  out.similar = { pieces: w.similar, makers: m.similar, contacts: c.similar };
  out.failed = (["pieces", "makers", "contacts", "records"] as const).filter((g) => failed.has(g));
  return out;
}
