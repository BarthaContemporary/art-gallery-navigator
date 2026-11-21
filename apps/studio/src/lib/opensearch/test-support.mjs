/*
 * Test support for the OpenSearch tests. Plain JavaScript on purpose: the
 * studio's tsconfig compiles only .ts/.tsx, and node --test runs only
 * *.test.ts, so this file is neither type-checked nor run on its own.
 *
 *   allowStudioImports()  lets node --test load the composition modules
 *                         (search.ts, load.ts, indexer.ts), which import
 *                         siblings without an extension and "@/lib/…" as the
 *                         studio's bundler does: a resolve hook adds ".ts"
 *                         and maps "@/" to apps/studio/src/.
 *   FakeDb                a minimal stand-in for the supabase-js client over
 *                         scripts/studio-preview/fixtures/data, with the
 *                         search_outbox objects of migration 0100. It refuses
 *                         a selected column the table does not have, as
 *                         PostgREST does, so the loaders' column lists are
 *                         checked against the fixture schema.
 *   os(), dropIndices()   raw requests to the test node, for setup and checks.
 *
 * Never used against a live service: OPENSEARCH_TEST_URL is a local node.
 */
import { register } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../../", import.meta.url).href; // apps/studio/src/
const FIXTURES = fileURLToPath(new URL("../../../../../scripts/studio-preview/fixtures/data/", import.meta.url));

let hooked = false;
export function allowStudioImports() {
  if (hooked) return;
  hooked = true;
  const hook = `
const SRC = ${JSON.stringify(SRC)};
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(SRC + specifier.slice(2) + ".ts", context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL && context.parentURL.startsWith(SRC) && !/\\.[a-z]+$/i.test(specifier)) {
    return next(specifier + ".ts", context);
  }
  return next(specifier, context);
}`;
  register(`data:text/javascript,${encodeURIComponent(hook)}`);
}

// ------------------------------------------------------------------ the test node

export const OS_URL = (process.env.OPENSEARCH_TEST_URL ?? "").replace(/\/+$/, "");
export const skipWithoutNode = OS_URL ? false : "OPENSEARCH_TEST_URL is not set";

/** A prefix of this run's own: oslib-<tag>-<time><pid>. Never "jvb". */
export function testPrefix(tag) {
  return `oslib-${tag}-${Date.now().toString(36)}${process.pid.toString(36)}`;
}

export async function os(method, path, body, { ndjson = false } = {}) {
  const res = await fetch(OS_URL + path, {
    method,
    headers: body === undefined ? {} : { "content-type": ndjson ? "application/x-ndjson" : "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

/** Delete every index of a test prefix, by exact name (the node may require names for deletes). */
export async function dropIndices(prefix) {
  if (!OS_URL || !prefix.startsWith("oslib-")) return;
  const r = await os("GET", `/_cat/indices/${prefix}-*?format=json&h=index`);
  for (const row of Array.isArray(r.json) ? r.json : []) await os("DELETE", `/${row.index}`);
}

/** Throws a clear message when the node refuses to create indices (a disk-watermark block). */
export async function assertNodeCanCreate(prefix) {
  const name = `${prefix}-probe-v1`;
  const r = await os("PUT", `/${name}`, { settings: { number_of_shards: 1, number_of_replicas: 0 } });
  await os("DELETE", `/${name}`);
  if (r.status !== 200) {
    throw new Error(`the test node refuses to create indices (${r.status} ${r.json?.error?.type ?? ""}); free disk space or use another node`);
  }
}

/** Whether a bulk write to a missing index of this prefix is refused (as production's action.auto_create_index=-jvb-*,+* does). */
export async function autoCreateRefused(prefix) {
  const name = `${prefix}-autoprobe-v1`;
  const r = await os("POST", `/${name}/_bulk?refresh=false`, `${JSON.stringify({ index: { _id: "x" } })}\n${JSON.stringify({ id: "x" })}\n`, { ndjson: true });
  const created = r.json?.items?.[0]?.index?.status === 201;
  if (created) await os("DELETE", `/${name}`);
  return !created;
}

// ------------------------------------------------------------------ a fake OpenSearch (no node)

/**
 * Just enough of OpenSearch for the indexer's paths, as a fetch stand-in:
 * index create/delete/mapping, _bulk with external_gte versions (409 for a
 * stale write, 404 for a delete of nothing, delete tombstones), the id
 * listing (_search sorted on id with search_after), _refresh, _forcemerge
 * and the status reads. Like production (action.auto_create_index=-jvb-*),
 * a bulk to a missing index is refused per item with 404
 * index_not_found_exception. `intercept(method, path, body)` may answer a
 * request first (return a Response), to inject a failure.
 */
export class FakeOpenSearch {
  constructor() {
    this.indices = new Map(); // name -> { mappings, docs: Map<id, { version, doc }>, tombstones: Map<id, version> }
    this.requests = [];
    this.intercept = null;
    this.realFetch = null;
  }
  install() {
    this.realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => this.handle(input, init);
    return this;
  }
  restore() {
    if (this.realFetch) globalThis.fetch = this.realFetch;
    this.realFetch = null;
  }
  ids(name) {
    return [...(this.indices.get(name)?.docs.keys() ?? [])].sort();
  }
  version(name, id) {
    return this.indices.get(name)?.docs.get(id)?.version ?? null;
  }
  async handle(input, init = {}) {
    const u = new URL(String(input));
    const method = init.method ?? "GET";
    const path = u.pathname;
    const body = typeof init.body === "string" ? init.body : "";
    this.requests.push({ method, path: path + u.search, body });
    const reply = (status, json) => new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
    const notFound = (name) => reply(404, { error: { type: "index_not_found_exception", reason: `no such index [${name}]` }, status: 404 });
    if (this.intercept) {
      const r = this.intercept(method, path + u.search, body);
      if (r) return r;
    }
    if (method === "GET" && path === "/_cluster/health") return reply(200, { status: "green" });
    if (method === "GET" && path === "/_cluster/settings") return reply(200, { persistent: {}, transient: {} });
    if (method === "GET" && path.startsWith("/_cat/indices/")) {
      return reply(200, [...this.indices].map(([index, i]) => ({ index, health: "green", "docs.count": String(i.docs.size), "docs.deleted": "0", "store.size": "1kb" })));
    }
    const m = /^\/([^/]+)(?:\/(_mapping|_settings|_bulk|_search|_refresh|_forcemerge|_count))?$/.exec(path);
    if (!m) return reply(400, { error: { type: "fake_unsupported" } });
    const [, name, action] = m;
    const index = this.indices.get(name);
    if (!action) {
      if (method === "PUT") {
        if (index) return reply(400, { error: { type: "resource_already_exists_exception" } });
        const parsed = JSON.parse(body || "{}");
        this.indices.set(name, { mappings: parsed.mappings ?? {}, docs: new Map(), tombstones: new Map() });
        return reply(200, { acknowledged: true, index: name });
      }
      if (method === "DELETE") {
        if (!index) return notFound(name);
        this.indices.delete(name);
        return reply(200, { acknowledged: true });
      }
    }
    if (action === "_bulk") return reply(200, this.bulk(name, index, body));
    if (!index) return notFound(name);
    if (action === "_mapping") return reply(200, { [name]: { mappings: index.mappings } });
    if (action === "_settings") return reply(200, { [name]: { settings: { index: {} } } });
    if (action === "_count") return reply(200, { count: index.docs.size });
    if (action === "_refresh" || action === "_forcemerge") return reply(200, { _shards: { total: 1, successful: 1, failed: 0 } });
    if (action === "_search") {
      const b = JSON.parse(body || "{}");
      const after = b.search_after?.[0];
      const page = this.ids(name).filter((id) => after === undefined || id > after).slice(0, b.size ?? 10);
      return reply(200, { hits: { hits: page.map((id) => ({ _id: id, _score: null, sort: [id] })) } });
    }
    return reply(400, { error: { type: "fake_unsupported" } });
  }
  bulk(name, index, body) {
    const lines = body.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const [op, meta] = Object.entries(lines[i])[0];
      const doc = op === "index" ? lines[++i] : null;
      if (!index) {
        items.push({ [op]: { _id: meta._id, status: 404, error: { type: "index_not_found_exception", reason: `no such index [${name}]` } } });
        continue;
      }
      const current = index.docs.get(meta._id)?.version ?? index.tombstones.get(meta._id) ?? -1;
      if (meta.version < current) {
        items.push({ [op]: { _id: meta._id, status: 409, error: { type: "version_conflict_engine_exception", reason: "current version is higher" } } });
      } else if (op === "index") {
        const created = !index.docs.has(meta._id);
        index.docs.set(meta._id, { version: meta.version, doc });
        index.tombstones.delete(meta._id);
        items.push({ index: { _id: meta._id, status: created ? 201 : 200, result: created ? "created" : "updated" } });
      } else if (!index.docs.has(meta._id)) {
        index.tombstones.set(meta._id, meta.version);
        items.push({ delete: { _id: meta._id, status: 404, result: "not_found" } });
      } else {
        index.docs.delete(meta._id);
        index.tombstones.set(meta._id, meta.version);
        items.push({ delete: { _id: meta._id, status: 200, result: "deleted" } });
      }
    }
    return { errors: items.some((it) => Object.values(it)[0].status >= 300), items };
  }
}

// ------------------------------------------------------------------ fixtures

const TABLES = [
  "pieces", "external_pieces", "makers", "categories", "locations", "provenance_entries", "piece_ledger_moves",
  "crm_contacts", "crm_organizations",
];

export function loadFixtures() {
  const out = {};
  for (const t of TABLES) out[t] = JSON.parse(fs.readFileSync(`${FIXTURES}${t}.json`, "utf8"));
  return out;
}

const lc = (v) => String(v ?? "").toLowerCase();
/** Numbers as numbers, everything else by code point (Postgres's uuid order for lower-case hex). */
const compare = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
const contains = (v, q) => v != null && lc(v).includes(lc(q));

// ------------------------------------------------------------------ a fake supabase-js client

/** What PostgREST 12.2.8 (infra/compose) answers for migration 0100's objects before it is applied (checked against the real thing). */
class NotSetUp {
  static table(name) {
    return { code: "42P01", details: null, hint: null, message: `relation "public.${name}" does not exist` };
  }
  static fn(name) {
    return { code: "PGRST202", message: `Could not find the function public.${name} in the schema cache` };
  }
}

/**
 * The parts of supabase-js that load.ts, indexer.ts and search.ts use:
 * from().select(cols, { count, head }).in/.is/.eq/.gt/.or/.order/.range/.limit,
 * from().delete().in(), from().upsert(), rpc(name, args).select(cols).limit(n).
 *
 * Answers as postgrest-js 2.110 does, including its quirk: a HEAD on a table
 * that does not exist gets PostgREST's body-less 404, which postgrest-js turns
 * into { error: null, count: null, status: 204 }. A GET gets the PGRST205 error.
 *
 *   cap       PostgREST's max_rows (rows per answer at most), default 1000
 *   onSelect  (table, query) => void, called before each select is answered:
 *             a test can change rows between two pages
 */
export class FakeDb {
  constructor({ setUp = true, clock = () => Date.now(), cap = 1000, onSelect = null } = {}) {
    this.tables = loadFixtures();
    this.tables.search_outbox = [];
    this.tables.search_state = [];
    this.setUp = setUp;
    this.clock = clock;
    this.cap = cap;
    this.onSelect = onSelect;
    this.calls = [];
    this.failTables = new Set();
    this.nextOutboxId = 1;
  }

  /** Queue an outbox row as the 0100 triggers would. */
  enqueue(entityType, entityId) {
    this.tables.search_outbox.push({ id: this.nextOutboxId++, entity_type: entityType, entity_id: entityId, queued_at: new Date().toISOString(), claimed_at: null });
  }

  rowsOf(table) {
    if (table === "vw_pieces_all") return [...this.tables.pieces, ...this.tables.external_pieces];
    return this.tables[table];
  }

  columnsOf(table) {
    const rows = this.rowsOf(table) ?? [];
    if (table === "vw_pieces_all") return new Set([...Object.keys(this.tables.pieces[0] ?? {}), "maker_name", "maker_life_dates", "category_name", "location_code"]);
    if (table === "search_outbox") return new Set(["id", "entity_type", "entity_id", "queued_at", "claimed_at"]);
    if (table === "search_state") return new Set(["kind", "last_run_at", "last_result", "last_error", "updated_at"]);
    return new Set(rows.flatMap((r) => Object.keys(r)));
  }

  from(table) {
    return new Query(this, table);
  }

  rpc(name, args = {}) {
    return new Rpc(this, name, args);
  }

  callRpc(name, args) {
    this.calls.push({ rpc: name, args });
    const outboxFn = name === "claim_search_outbox" || name === "search_clock_ms";
    if (outboxFn && !this.setUp) return { data: null, error: NotSetUp.fn(name), status: 404 };
    if (name === "search_clock_ms") return { data: this.clock(), error: null, status: 200 };
    if (name === "claim_search_outbox") {
      const batch = Math.max(1, Math.min(args.batch ?? 200, 1000));
      const now = Date.now();
      const free = this.tables.search_outbox.filter((r) => r.claimed_at === null || now - Date.parse(r.claimed_at) > 120_000).sort((a, b) => a.id - b.id).slice(0, batch);
      const ms = this.clock();
      for (const r of free) r.claimed_at = new Date(now).toISOString();
      return { data: free.map((r) => ({ id: r.id, entity_type: r.entity_type, entity_id: r.entity_id, claimed_ms: ms })), error: null, status: 200 };
    }
    if (name === "pieces_search") {
      // Close enough to 0077 for the merge: contains on numbers, title, description and maker names; exact, then contains, then the rest.
      const q = String(args.q ?? "");
      const makers = new Map(this.tables.makers.map((m) => [m.id, m]));
      const rows = this.rowsOf("vw_pieces_all").filter((p) => {
        if (p.deleted_at) return false;
        const m = makers.get(p.maker_id);
        return [p.stock_number, p.legacy_stock_number, p.title, p.description, m?.display_name, m?.native_name, m?.romanized_name].some((v) => contains(v, q));
      });
      const rank = (p) => (p.stock_number === q || p.legacy_stock_number === q ? 0 : contains(p.stock_number, q) || contains(p.legacy_stock_number, q) ? 1 : 2);
      rows.sort((a, b) => rank(a) - rank(b) || String(a.stock_number).localeCompare(String(b.stock_number)));
      return { data: rows, error: null, status: 200, table: "pieces" };
    }
    if (name === "crm_contacts_search") {
      const q = String(args.q ?? "");
      const rows = this.tables.crm_contacts
        .filter((c) => [c.first_name, c.last_name, c.email, `${c.first_name ?? ""} ${c.last_name ?? ""}`].some((v) => contains(v, q)))
        .slice(0, 100);
      return { data: rows, error: null, status: 200, table: "crm_contacts" };
    }
    return { data: null, error: NotSetUp.fn(name), status: 404 };
  }
}

const SELECT_COLUMN = /^[a-z_][a-z0-9_]*$/;

function project(rows, select, known) {
  if (select === "*") return { error: { code: "TEST", message: "select * is not allowed in these modules" } };
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  for (const c of cols) {
    if (!SELECT_COLUMN.test(c)) return { error: { code: "TEST", message: `unexpected select item ${c}` } };
    if (!known.has(c)) return { error: { code: "42703", message: `column ${c} does not exist` } };
  }
  return { rows: rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))) };
}

class Thenable {
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }
}

class Rpc extends Thenable {
  constructor(db, name, args) {
    super();
    this.db = db;
    this.name = name;
    this.args = args;
    this.selectCols = null;
    this.limitN = null;
  }
  select(cols) {
    this.selectCols = cols;
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  run() {
    const r = this.db.callRpc(this.name, this.args);
    const last = this.db.calls[this.db.calls.length - 1];
    if (last && last.rpc === this.name) last.limit = this.limitN;
    if (r.error || !this.selectCols) return { data: r.data, error: r.error, status: r.status };
    const rows = this.limitN === null || !Array.isArray(r.data) ? r.data : r.data.slice(0, this.limitN);
    const p = project(rows, this.selectCols, this.db.columnsOf(r.table));
    return p.error ? { data: null, error: p.error, status: 400 } : { data: p.rows, error: null, status: 200 };
  }
}

class Query extends Thenable {
  constructor(db, table) {
    super();
    this.db = db;
    this.table = table;
    this.op = "select";
    this.cols = "*";
    this.count = null;
    this.head = false;
    this.filters = [];
    this.orderBy = null;
    this.window = null;
    this.limitN = null;
    this.payload = null;
  }
  select(cols = "*", opts = {}) {
    if (this.op === "select") this.op = "select";
    this.cols = cols;
    this.count = opts.count ?? null;
    this.head = opts.head === true;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  upsert(row, opts = {}) {
    this.op = "upsert";
    this.payload = Array.isArray(row) ? row : [row];
    this.onConflict = opts.onConflict ?? "id";
    return this;
  }
  in(col, values) {
    this.filters.push((r) => values.map(String).includes(String(r[col])));
    this.inSizes = [...(this.inSizes ?? []), values.length];
    return this;
  }
  is(col, value) {
    this.filters.push((r) => (r[col] ?? null) === value);
    return this;
  }
  eq(col, value) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  gt(col, value) {
    this.filters.push((r) => r[col] != null && compare(r[col], value) > 0);
    this.after = { col, value };
    return this;
  }
  or(expr) {
    const parts = expr.split(",").map((p) => {
      const m = /^([a-z_]+)\.ilike\.(.*)$/.exec(p);
      if (!m) throw new Error(`fake db: unsupported or() part ${p}`);
      return [m[1], m[2].replace(/^%|%$/g, "")];
    });
    this.filters.push((r) => parts.some(([c, q]) => contains(r[c], q)));
    return this;
  }
  order(col) {
    this.orderBy = col;
    return this;
  }
  range(from, to) {
    this.window = [from, to];
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  run() {
    const db = this.db;
    db.calls.push({ table: this.table, op: this.op, cols: this.cols, head: this.head, inSizes: this.inSizes ?? [], after: this.after?.value ?? null, window: this.window, limit: this.limitN });
    const missing = ((this.table === "search_outbox" || this.table === "search_state") && !db.setUp) || !db.rowsOf(this.table);
    if (missing) {
      // postgrest-js: PostgREST's 404 to a HEAD has no body, which it reports as status 204 with no error.
      if (this.op === "select" && this.head) return { data: null, count: null, error: null, status: 204 };
      return { data: null, count: null, error: NotSetUp.table(this.table), status: 404 };
    }
    if (db.failTables.has(this.table)) return { data: null, count: null, error: { code: "57014", message: "canceling statement due to statement timeout" }, status: 500 };
    if (this.op === "select" && db.onSelect) db.onSelect(this.table, this);
    const all = db.rowsOf(this.table);
    if ((this.inSizes ?? []).some((n) => n > 100)) return { data: null, error: { code: "TEST", message: "more than 100 ids in one request" }, status: 414 };
    if (this.op === "upsert") {
      for (const row of this.payload) {
        const i = all.findIndex((r) => r[this.onConflict] === row[this.onConflict]);
        if (i >= 0) all[i] = { ...all[i], ...row };
        else all.push({ ...row });
      }
      return { data: null, error: null, status: 201 };
    }
    let rows = all.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "delete") {
      const gone = new Set(rows);
      db.tables[this.table] = all.filter((r) => !gone.has(r));
      return { data: null, error: null, status: 204 };
    }
    if (this.orderBy === "id") rows = [...rows].sort((a, b) => compare(a.id, b.id)); // uuid order: byte order of the lower-case hex
    else if (this.orderBy) rows = [...rows].sort((a, b) => String(a[this.orderBy] ?? "").localeCompare(String(b[this.orderBy] ?? "")));
    const total = rows.length;
    if (this.head) return { data: null, count: this.count ? total : null, error: null, status: 200 };
    if (this.window) rows = rows.slice(this.window[0], this.window[1] + 1);
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);
    // PostgREST's row cap, so a loader that forgets to page is caught.
    rows = rows.slice(0, db.cap);
    const p = project(rows, this.cols, db.columnsOf(this.table));
    if (p.error) return { data: null, error: p.error, status: 400 };
    return { data: p.rows, count: this.count ? total : null, error: null, status: 200 };
  }
}
