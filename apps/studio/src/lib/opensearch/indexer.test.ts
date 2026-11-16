// node --test apps/studio/src/lib/opensearch/indexer.test.ts
// The indexer's edges without a node: migration 0100 absent, OpenSearch unconfigured, the erase fallbacks.
// (indexer.int.test.ts runs the real thing against a local node.)
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports } from "./test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { testSearchConfig } from "./config.ts";

allowStudioImports();
type Indexer = typeof import("./indexer");
let ix: Indexer;
before(async () => {
  // @ts-ignore TS5097
  ix = (await import("./indexer.ts")) as Indexer;
});

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
