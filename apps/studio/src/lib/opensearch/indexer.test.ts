// node --test apps/studio/src/lib/opensearch/indexer.test.ts
// The indexer's edges without a node: migration 0100 absent, OpenSearch unconfigured, the erase fallbacks.
// (indexer.int.test.ts runs the real thing against a local node.)
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, FakeOpenSearch, allowStudioImports } from "./test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { testSearchConfig } from "./config.ts";

allowStudioImports();
type Indexer = typeof import("./indexer");
type Load = typeof import("./load");
let ix: Indexer;
let load: Load;
before(async () => {
  // @ts-ignore TS5097
  ix = (await import("./indexer.ts")) as Indexer;
  // @ts-ignore TS5097
  load = (await import("./load.ts")) as Load;
});
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-unit");
let requests: { method: string; url: string }[] = [];
let answer: (method: string, url: string) => Response | Error = () => new Response("{}", { status: 200 });
const realFetch = globalThis.fetch;
const realError = console.error;
beforeEach(() => {
  requests = [];
  console.error = () => {};
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    requests.push({ method, url: String(input) });
    const a = answer(method, String(input));
    if (a instanceof Error) throw a;
    return a;
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  load.setPageRowsForTests(undefined);
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

test("migration 0100 absent: 'not set up', and nothing is sent", async () => {
  const db = new FakeDb({ setUp: false });
  db.tables.search_outbox.push({ id: 1, entity_type: "work", entity_id: "x", queued_at: "", claimed_at: null });
  assert.equal((await ix.drainSearchOutbox(db, cfg)).status, "not set up");
  assert.equal((await ix.drainSearchOutbox(db, null)).status, "not set up");
  const r = await ix.reconcile(db, cfg);
  assert.equal(r.status, "not set up");
  assert.equal(requests.length, 0);
});

test("the codes that mean 'not set up'", () => {
  for (const e of [{ code: "PGRST202" }, { code: "PGRST205" }, { code: "42P01" }, { code: "42883" }, { message: "Could not find the table 'public.search_outbox' in the schema cache" }, { message: 'relation "public.search_outbox" does not exist' }]) {
    assert.equal(ix.isNotSetUp(e), true, JSON.stringify(e));
  }
  assert.equal(ix.isNotSetUp({ code: "57014", message: "canceling statement due to statement timeout" }), false);
  assert.equal(ix.isNotSetUp(null), false);
  assert.equal(ix.isNotSetUp({}, 404), true);
});

test("not configured: the drain claims and discards, the rest says so", async () => {
  const db = new FakeDb();
  for (let i = 0; i < 5; i++) db.enqueue("work", `w${i}`);
  const r = await ix.drainSearchOutbox(db, null, { batch: 2, rounds: 10 });
  assert.deepEqual([r.status, r.claimed, r.done, r.left], ["not configured", 5, 5, 0]);
  assert.equal(db.tables.search_outbox.length, 0);
  assert.deepEqual(await ix.reconcile(db, null), { status: "not configured", kinds: [] });
  assert.deepEqual(await ix.deleteContactFromIndex(null, "c"), { status: "not configured" });
  assert.equal(requests.length, 0);
});

test("an empty outbox is a quiet 'ok' that writes no state", async () => {
  const db = new FakeDb();
  const r = await ix.drainSearchOutbox(db, cfg);
  assert.deepEqual([r.status, r.claimed], ["ok", 0]);
  assert.equal(db.tables.search_state.length, 0);
  assert.equal(requests.length, 0);
});

test("status without OpenSearch: not configured, or misconfigured with a reason", async () => {
  const db = new FakeDb();
  db.enqueue("work", "w1");
  const saved = process.env.OPENSEARCH_URL;
  try {
    delete process.env.OPENSEARCH_URL;
    let s = await ix.searchStatus(db, null);
    assert.deepEqual([s.engine, s.problem, s.setUp, s.pending], ["not configured", null, true, 1]);
    assert.equal(s.indices.find((i: { kind: string }) => i.kind === "works")?.name, "jvb-works-v1");
    assert.ok((s.indices.find((i: { kind: string }) => i.kind === "contacts")?.database ?? 0) > 0);
    process.env.OPENSEARCH_URL = "http://search.example.com";
    s = await ix.searchStatus(db, null);
    assert.equal(s.engine, "misconfigured");
    assert.match(s.problem ?? "", /https/);
  } finally {
    if (saved === undefined) delete process.env.OPENSEARCH_URL;
    else process.env.OPENSEARCH_URL = saved;
  }
  assert.equal(requests.length, 0);
});

test("erase: deleted, already gone, read-only (drops the index), unreachable (never throws)", async () => {
  const bulkItem = (status: number, type?: string) => json(200, { items: [{ delete: { status, ...(type ? { error: { type } } : {}) } }] });
  answer = () => bulkItem(200);
  assert.deepEqual(await ix.deleteContactFromIndex(cfg, "c1"), { status: "deleted" });
  assert.match(requests[0]!.url, /\/oslib-unit-contacts-v1\/_bulk\?refresh=true$/);
  answer = () => bulkItem(404);
  assert.deepEqual(await ix.deleteContactFromIndex(cfg, "c1"), { status: "gone" });
  answer = () => bulkItem(404, "index_not_found_exception");
  assert.deepEqual(await ix.deleteContactFromIndex(cfg, "c1"), { status: "gone" });
  requests = [];
  answer = (method) => (method === "DELETE" ? json(200, { acknowledged: true }) : bulkItem(429, "cluster_block_exception"));
  assert.deepEqual(await ix.deleteContactFromIndex(cfg, "c1"), { status: "index dropped" });
  assert.deepEqual(requests.map((r) => [r.method, new URL(r.url).pathname]), [["POST", "/oslib-unit-contacts-v1/_bulk"], ["DELETE", "/oslib-unit-contacts-v1"]]);
  // A full write queue (429, but not a block) is a failure to retry, never a reason to drop the index.
  for (const reply of [() => bulkItem(429, "es_rejected_execution_exception"), () => json(429, { error: { type: "es_rejected_execution_exception" } })]) {
    requests = [];
    answer = reply;
    const busy = await ix.deleteContactFromIndex(cfg, "c1");
    assert.equal(busy.status, "failed");
    assert.match(busy.error ?? "", /429 es_rejected_execution_exception/);
    assert.deepEqual(requests.map((r) => r.method), ["POST"], "no DELETE of the index");
  }
  answer = () => new TypeError("fetch failed");
  const r = await ix.deleteContactFromIndex(cfg, "c1");
  assert.equal(r.status, "failed");
  assert.ok(!(r.error ?? "").includes("c1"));
});

test("erase writes at a version no in-flight drain can beat", async () => {
  let body = "";
  globalThis.fetch = (async (_: string | URL, init: RequestInit = {}) => {
    body = String(init.body);
    return json(200, { items: [{ delete: { status: 200 } }] });
  }) as typeof fetch;
  await ix.deleteContactFromIndex(cfg, "c1");
  assert.deepEqual(JSON.parse(body.trim()), { delete: { _id: "c1", version: Number.MAX_SAFE_INTEGER, version_type: "external_gte" } });
  assert.equal(ix.ERASE_VERSION, Number.MAX_SAFE_INTEGER);
});

test("reconcile: a create-index block aborts and keeps the old index; nothing is deleted", async () => {
  const db = new FakeDb();
  answer = (method, url) => {
    if (method === "GET" && url.endsWith("/_mapping")) return json(404, { error: { type: "index_not_found_exception" } });
    if (method === "PUT") return json(403, { error: { type: "index_create_block_exception", reason: "blocked by: [FORBIDDEN/10/cluster create-index blocked (api)]" } });
    return json(500, { error: { type: "unexpected" } });
  };
  const r = await ix.reconcile(db, cfg, ["works"]);
  assert.equal(r.status, "blocked");
  assert.match(r.kinds[0]!.error ?? "", /disk nearly full/);
  assert.deepEqual(requests.map((q) => q.method), ["GET", "PUT"], "no bulk, no delete");
  assert.match(db.tables.search_state.find((s: { kind: string }) => s.kind === "works")?.last_result ?? "", /^blocked/);
});

// ------------------------------------------------------------------ with a fake node (test-support.mjs)

const live = (db: Row) => (db.rowsOf("vw_pieces_all") as Row[]).filter((p) => !p.deleted_at);
const pieceRow = (db: Row, id: string) => (db.tables.pieces as Row[]).find((p) => p.id === id) ?? (db.tables.external_pieces as Row[]).find((p) => p.id === id)!;

test("self-heal: the drain finds the index missing (404 index_not_found_exception per item), reconciles that kind, finishes its rows", async () => {
  // The production path on any node: auto-creation is refused for the index
  // names, so the drain's bulk comes back 404 per item and the kind is rebuilt.
  const os = new FakeOpenSearch().install();
  const db = new FakeDb();
  const contact = (db.tables.crm_contacts as Row[]).find((c) => !c.erased_at)!;
  db.enqueue("contact", contact.id);
  db.enqueue("work", live(db)[0]!.id); // a kind whose index is missing too
  const r = await ix.drainSearchOutbox(db, cfg);
  os.restore();
  assert.equal(r.status, "ok", JSON.stringify(r));
  assert.deepEqual([...r.healed].sort(), ["contacts", "works"]);
  assert.deepEqual([r.claimed, r.done, r.left, r.failed, r.blocked], [2, 2, 0, 0, 0]);
  assert.equal(db.tables.search_outbox.length, 0, "the healed rows are finished and deleted");
  const methods = os.requests.map((q: Row) => `${q.method} ${q.path}`);
  assert.ok(methods.includes("POST /oslib-unit-contacts-v1/_bulk?refresh=true"), "the drain tried first");
  assert.ok(methods.includes("PUT /oslib-unit-contacts-v1"), "then the reconcile created the index");
  assert.ok(methods.includes("POST /oslib-unit-contacts-v1/_forcemerge?only_expunge_deletes=true"));
  assert.deepEqual(os.ids("oslib-unit-contacts-v1"), (db.tables.crm_contacts as Row[]).filter((c) => !c.erased_at).map((c) => c.id).sort());
  assert.deepEqual(os.ids("oslib-unit-works-v1"), live(db).map((p) => p.id).sort());
  assert.match((db.tables.search_state as Row[]).find((s) => s.kind === "drain")?.last_result ?? "", /rebuilt/);
});

test("self-heal that fails leaves the rows claimed for the next drain", async () => {
  const os = new FakeOpenSearch().install();
  os.intercept = (method: string) => (method === "PUT" ? json(403, { error: { type: "index_create_block_exception" } }) : undefined);
  const db = new FakeDb();
  db.enqueue("contact", (db.tables.crm_contacts as Row[])[0]!.id);
  const r = await ix.drainSearchOutbox(db, cfg);
  os.restore();
  assert.deepEqual([r.status, r.done, r.left, r.blocked], ["failed", 0, 1, 1]);
  assert.deepEqual(r.healed, []);
  assert.equal(db.tables.search_outbox.length, 1);
});

test("keyset paging: a work trashed between two pages costs no live work its read", async () => {
  load.setPageRowsForTests(10);
  const db = new FakeDb({ cap: 10 });
  const byId = live(db).map((p) => p.id).sort();
  assert.ok(byId.length > 30, "enough works for several pages");
  let trashed: string | null = null;
  db.onSelect = (table: string, q: Row) => {
    // Before the second page of works: trash a work the first page already read.
    if (table === "vw_pieces_all" && q.after !== undefined && trashed === null) {
      trashed = byId[2]!;
      pieceRow(db, trashed).deleted_at = new Date().toISOString();
    }
  };
  const sources = await load.loadWorkSources(db as never, "all");
  assert.ok(trashed);
  // Offset paging would have skipped the first work of page 2 (byId[10]).
  for (const id of byId) assert.ok(sources.has(id), `work ${byId.indexOf(id)} was read`);
  const pages = (db.calls as Row[]).filter((c) => c.table === "vw_pieces_all");
  assert.ok(pages.length >= 4);
  assert.ok(pages.every((c) => c.window === null && c.limit === 10), "keyset: limit and id > last, never an offset");
  assert.deepEqual(pages.slice(1).map((c) => typeof c.after), pages.slice(1).map(() => "string"));
});

test("reconcile re-reads stale ids by id: a live record the full read missed is written, not deleted", async () => {
  const os = new FakeOpenSearch().install();
  const db = new FakeDb();
  let t = 1_000_000;
  db.clock = () => t;
  assert.equal((await ix.reconcile(db, cfg, ["works"])).status, "ok");
  const w = live(db)[5]!;
  const purged = live(db)[6]!;
  // The next reconcile's full read happens while w is in the trash; it is restored straight after.
  let phase = 0;
  db.onSelect = (table: string, q: Row) => {
    if (table === "vw_pieces_all" && (q.inSizes ?? []).length === 0 && phase === 0) {
      phase = 1;
      pieceRow(db, w.id).deleted_at = new Date().toISOString();
    } else if (phase === 1) {
      phase = 2;
      pieceRow(db, w.id).deleted_at = null;
    }
  };
  db.tables.pieces = (db.tables.pieces as Row[]).filter((p) => p.id !== purged.id);
  db.tables.external_pieces = (db.tables.external_pieces as Row[]).filter((p) => p.id !== purged.id);
  t += 1000;
  const r = await ix.reconcile(db, cfg, ["works"]);
  os.restore();
  assert.equal(r.status, "ok", JSON.stringify(r));
  assert.equal(phase, 2);
  assert.equal(r.kinds[0]!.removed, 1, "only the purged work is removed");
  assert.ok(os.ids("oslib-unit-works-v1").includes(w.id), "the live work stays");
  assert.equal(os.version("oslib-unit-works-v1", w.id), t, "written at this reconcile's clock");
  assert.ok(!os.ids("oslib-unit-works-v1").includes(purged.id));
});

test("status: migration 0100 absent, as postgrest-js really answers a HEAD (no error, status 204, no count)", async () => {
  // A HEAD to a missing table gets PostgREST's body-less 404, which postgrest-js
  // reports as { error: null, count: null, status: 204 }: only a GET can tell.
  const bare = new FakeDb({ setUp: false });
  const head = await bare.from("search_outbox").select("id", { count: "exact", head: true });
  assert.deepEqual([head.error, head.count, head.status], [null, null, 204]);
  const s = await ix.searchStatus(bare, null);
  assert.equal(s.setUp, false);
  assert.equal(s.pending, null);
  assert.ok((s.indices.find((i: Row) => i.kind === "works")?.database ?? 0) > 0, "the other counts still work");
  // Applied, with an empty outbox: set up, 0 pending.
  const db = new FakeDb();
  const ok = await ix.searchStatus(db, null);
  assert.deepEqual([ok.setUp, ok.pending], [true, 0]);
  // The outbox is read with a GET (it carries a body), never a HEAD.
  const outboxReads = (db.calls as Row[]).filter((c) => c.table === "search_outbox");
  assert.deepEqual(outboxReads.map((c) => c.head), [false]);
});

test("status: a count that comes back empty is unknown, not 0", async () => {
  const db = new FakeDb();
  const realFrom = db.from.bind(db);
  // A table answering like a missing one to a HEAD: no error, no count.
  db.from = (table: string) => {
    const q = realFrom(table);
    if (table === "makers") q.run = () => ({ data: null, count: null, error: null, status: 204 });
    return q;
  };
  const s = await ix.searchStatus(db, null);
  assert.equal(s.indices.find((i: Row) => i.kind === "makers")?.database, null);
});
