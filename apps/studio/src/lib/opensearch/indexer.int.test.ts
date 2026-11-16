// Against a local OpenSearch (security off), with this run's own index prefix:
//   OPENSEARCH_TEST_URL=http://127.0.0.1:9209 node --test apps/studio/src/lib/opensearch/indexer.int.test.ts
// Without the variable every test here is skipped.
//
// Writes, versions, the reconcile, the outbox drain, the erasure delete and the
// Admin status, with the fixtures behind a fake service client (test-support.mjs)
// that provides migration 0100's objects.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports, assertNodeCanCreate, autoCreateRefused, dropIndices, os, skipWithoutNode as skip, testPrefix } from "./test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { INDEX_VERSION, indexName, testSearchConfig } from "./config.ts";
// @ts-ignore TS5097
import { bulk, listIndexedIds, resetCircuit, searchIds } from "./client.ts";
// @ts-ignore TS5097
import { buildSearch } from "./query.ts";

allowStudioImports();
type Indexer = typeof import("./indexer");
let ix: Indexer;
const prefix = testPrefix("ix");
const URL_ = process.env.OPENSEARCH_TEST_URL || "http://127.0.0.1:1";
const cfg = testSearchConfig(URL_, prefix);
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let refusesAutoCreate = false;

before(async () => {
  // @ts-ignore TS5097
  ix = (await import("./indexer.ts")) as Indexer;
  if (skip) return;
  await assertNodeCanCreate(prefix);
  refusesAutoCreate = await autoCreateRefused(prefix);
});
after(async () => {
  if (!skip) await dropIndices(prefix);
});

const find = async (kind: "works" | "makers" | "contacts", q: string, c = cfg) => {
  resetCircuit();
  return (await searchIds(c, kind, buildSearch(kind, q)!, { size: 500, timeoutMs: 5000 })) ?? [];
};
const exists = async (name: string) => (await os("GET", `/${name}/_mapping`)).status === 200;
const countOf = async (name: string) => {
  await os("POST", `/${name}/_refresh`);
  return (await os("GET", `/${name}/_count`)).json?.count;
};
const live = (db: Row) => db.rowsOf("vw_pieces_all").filter((p: Row) => !p.deleted_at) as Row[];

test("external_gte: a stale write is 409 (superseded), a delete keeps a stale write out, a missing delete is gone", { skip }, async () => {
  const c = testSearchConfig(URL_, `${prefix}-v`);
  await ix.ensureIndex(c, "makers");
  const doc = (name: string) => ({ id: "m1", name, name_sort: name, web_visible: true });
  let r = await bulk(c, "makers", [{ op: "index", id: "m1", doc: doc("Second edit") }], { version: 2000, refresh: true });
  assert.equal(r.ok, 1);
  r = await bulk(c, "makers", [{ op: "index", id: "m1", doc: doc("First edit") }], { version: 1500, refresh: true });
  assert.deepEqual([r.ok, r.superseded, r.items[0].result], [0, 1, "superseded"]);
  // The same version again is accepted (gte): a retried drain is harmless.
  r = await bulk(c, "makers", [{ op: "index", id: "m1", doc: doc("Second edit") }], { version: 2000, refresh: true });
  assert.equal(r.ok, 1);
  resetCircuit();
  assert.deepEqual(await searchIds(c, "makers", buildSearch("makers", '"second edit"')!, { timeoutMs: 5000 }), ["m1"]);
  r = await bulk(c, "makers", [{ op: "delete", id: "m1" }, { op: "delete", id: "never-indexed" }], { version: 3000, refresh: true });
  assert.deepEqual(r.items.map((i: Row) => i.result), ["ok", "gone"]);
  r = await bulk(c, "makers", [{ op: "index", id: "m1", doc: doc("Second edit") }], { version: 2500, refresh: true });
  assert.equal(r.items[0].result, "superseded", "a stale write cannot bring a deleted document back");
  // Strict mapping: a field the mapping lacks is refused, with its type only.
  r = await bulk(c, "makers", [{ op: "index", id: "m2", doc: { ...doc("x"), id: "m2", notes: "Hiroshi Tanaka" } }], { version: 1, refresh: true });
  assert.deepEqual([r.items[0].result, r.items[0].type], ["failed", "strict_dynamic_mapping_exception"]);
  assert.ok(!JSON.stringify(r).includes("Tanaka"));
  await dropIndices(`${prefix}-v`);
});

test("reconcile: creates the indices and indexes every record a staff member may search", { skip }, async () => {
  const db = new FakeDb();
  const r = await ix.reconcile(db, cfg);
  assert.equal(r.status, "ok", JSON.stringify(r));
  assert.deepEqual(r.kinds.map((k: Row) => [k.kind, k.created]), [["works", true], ["makers", true], ["contacts", true]]);
  assert.equal(await countOf(cfg.indices.works), live(db).length);
  assert.equal(await countOf(cfg.indices.makers), db.tables.makers.length);
  assert.equal(await countOf(cfg.indices.contacts), db.tables.crm_contacts.filter((c: Row) => !c.erased_at).length);
  const mapping = (await os("GET", `/${cfg.indices.works}/_mapping`)).json[cfg.indices.works].mappings;
  assert.deepEqual(mapping._meta, { schema_version: INDEX_VERSION.works });
  assert.equal(mapping.dynamic, "strict");
  // search_state got one row per kind; no select * anywhere; no request over 100 ids.
  assert.deepEqual(db.tables.search_state.map((s: Row) => s.kind).sort(), ["contacts", "makers", "works"]);
  assert.match(db.tables.search_state.find((s: Row) => s.kind === "works").last_result, /^ok: \d+ indexed/);
  assert.ok(db.calls.filter((c: Row) => c.op === "select").every((c: Row) => c.cols !== "*"));
  // A second run changes nothing and creates nothing.
  const again = await ix.reconcile(db, cfg);
  assert.deepEqual(again.kinds.map((k: Row) => [k.status, k.created, k.removed]), [["ok", false, 0], ["ok", false, 0], ["ok", false, 0]]);
});

test("reconcile keeps newer edits, removes ids gone from the database, keeps records created since", { skip }, async () => {
  const db = new FakeDb();
  const cfg = testSearchConfig(URL_, `${prefix}-late`); // its own indices: its clocks are in the past
  // Clocks in the past, so later tests (which use the wall clock) are newer still.
  const t0 = Date.now() - 120_000;
  db.clock = () => t0;
  await ix.reconcile(db, cfg, ["works"]);
  const [kept, purged] = live(db) as Row[];
  // A drain that read the database later wrote a newer title, and indexed a brand-new work.
  await bulk(cfg, "works", [
    { op: "index", id: kept!.id, doc: { id: kept!.id, stock_number: kept!.stock_number, title: "Retitled by a later drain", status: "in_stock", ledger: "jvb", web_visible: false, framed: false } },
    { op: "index", id: "5e000000-0f00-4000-8000-5e0000000000", doc: { id: "5e000000-0f00-4000-8000-5e0000000000", stock_number: "2026-0777", title: "Created since", status: "in_stock", ledger: "jvb", web_visible: false, framed: false } },
  ], { version: t0 + 5000, refresh: true });
  // A work purged from the database since.
  db.tables.pieces = db.tables.pieces.filter((p: Row) => p.id !== purged!.id);
  db.tables.external_pieces = db.tables.external_pieces.filter((p: Row) => p.id !== purged!.id);
  // A reconcile whose clock is OLDER than the drain's (it read the database before that edit) arrives late.
  db.clock = () => t0 + 1000;
  const r = await ix.reconcile(db, cfg, ["works"]);
  assert.equal(r.status, "ok");
  assert.ok(r.kinds[0].superseded >= 2, JSON.stringify(r.kinds[0]));
  assert.equal(r.kinds[0].removed, 1);
  assert.deepEqual(await find("works", '"retitled by a later drain"', cfg), [kept!.id], "the newer edit stays");
  assert.deepEqual(await find("works", "2026-0777", cfg), ["5e000000-0f00-4000-8000-5e0000000000"], "a record created since stays");
  const ids = await listIndexedIds(cfg, "works");
  assert.ok(!ids.includes(purged!.id), "the purged work is gone");
  // A later reconcile (newer clock) puts the database's own state back.
  db.clock = () => t0 + 10_000;
  await ix.reconcile(db, cfg, ["works"]);
  assert.deepEqual(await find("works", '"retitled by a later drain"', cfg), []);
  assert.ok(!(await listIndexedIds(cfg, "works")).includes("5e000000-0f00-4000-8000-5e0000000000"));
  await dropIndices(`${prefix}-late`);
});

test("reconcile builds a new version beside the old one and then deletes the lower versions", { skip }, async () => {
  const db = new FakeDb();
  const p = `${prefix}-bump`;
  const v1 = testSearchConfig(URL_, p);
  await ix.reconcile(db, v1, ["makers"]);
  assert.ok(await exists(indexName("makers", p, 1)));
  const original = INDEX_VERSION.makers;
  (INDEX_VERSION as Record<string, number>).makers = original + 1; // as a mapping change would
  try {
    const v2 = testSearchConfig(URL_, p);
    assert.equal(v2.indices.makers, indexName("makers", p, original + 1));
    const r = await ix.reconcile(db, v2, ["makers"]);
    assert.equal(r.status, "ok", JSON.stringify(r));
    assert.ok(r.kinds[0].created);
    assert.equal(await countOf(v2.indices.makers), db.tables.makers.length);
    assert.equal(await exists(indexName("makers", p, original)), false, "the lower version is deleted by name");
  } finally {
    (INDEX_VERSION as Record<string, number>).makers = original;
    await dropIndices(p);
  }
});

test("an index of the right name that this code did not make is replaced", { skip }, async () => {
  const p = `${prefix}-imp`;
  const c = testSearchConfig(URL_, p);
  await os("PUT", `/${c.indices.makers}`, { mappings: { properties: { notes: { type: "text" } } } });
  const r = await ix.reconcile(new FakeDb(), c, ["makers"]);
  assert.equal(r.kinds[0].created, true);
  const m = (await os("GET", `/${c.indices.makers}/_mapping`)).json[c.indices.makers].mappings;
  assert.equal(m.dynamic, "strict");
  assert.equal(m.properties.notes, undefined);
  await dropIndices(p);
});

test("drain: claims, fans out, writes the current state, deletes the finished rows", { skip }, async () => {
  const db = new FakeDb();
  await ix.reconcile(db, cfg);
  const works = live(db);
  const retitled = works[0]!;
  const trashed = works[1]!;
  const yosai = db.tables.makers.find((m: Row) => m.display_name === "Yokota Yōsai");
  const category = db.tables.categories.find((c: Row) => works.some((w) => w.category_id === c.id));
  const bewick = db.tables.crm_contacts.find((c: Row) => c.last_name === "Bewick");
  const org = db.tables.crm_organizations[0];

  // The edits, and the outbox rows 0100's triggers would queue for them.
  db.tables.pieces.find((p: Row) => p.id === retitled.id).title = "Drained title";
  db.enqueue("work", retitled.id);
  db.enqueue("work", retitled.id); // a second save of the same work: de-duplicated within the batch
  (db.tables.pieces.find((p: Row) => p.id === trashed.id) ?? db.tables.external_pieces.find((p: Row) => p.id === trashed.id)).deleted_at = new Date().toISOString();
  db.enqueue("work", trashed.id);
  yosai.display_name = "Yokota Yōsai Renamed";
  db.enqueue("maker", yosai.id);
  category.name = "Drainedcategory";
  db.enqueue("category", category.id);
  bewick.organization_id = org.id;
  org.name = "Drainedorg Museum";
  db.enqueue("organization", org.id);
  db.enqueue("work", "5e000000-0e00-4000-8000-5e0000000000"); // purged long ago: a delete of nothing

  const r = await ix.drainSearchOutbox(db, cfg, { batch: 3 });
  assert.equal(r.status, "ok", JSON.stringify(r));
  assert.equal(r.claimed, 7);
  assert.equal(r.done, 7);
  assert.equal(db.tables.search_outbox.length, 0, "every finished row is deleted");
  assert.deepEqual(await find("works", '"drained title"'), [retitled.id], "searchable at once (refresh=true)");
  assert.ok(!(await listIndexedIds(cfg, "works")).includes(trashed.id), "the trash leaves the index");
  const yosaiWorks = works.filter((w) => w.maker_id === yosai.id && w.id !== trashed.id).map((w) => w.id).sort();
  assert.ok(yosaiWorks.length > 0);
  assert.deepEqual((await find("works", "renamed")).sort(), yosaiWorks, "a maker's rename reaches its works");
  assert.deepEqual(await find("makers", "renamed"), [yosai.id]);
  const inCategory = works.filter((w) => w.category_id === category.id && w.id !== trashed.id).map((w) => w.id).sort();
  assert.deepEqual((await find("works", "drainedcategory")).sort(), inCategory);
  assert.deepEqual(await find("contacts", "drainedorg"), [bewick.id], "an organisation's rename reaches its contacts");
  assert.match(db.tables.search_state.find((s: Row) => s.kind === "drain").last_result, /^ok: 7 claimed, 7 done, 0 left/);
});

test("drain: a stale batch is superseded and still finished", { skip }, async () => {
  const db = new FakeDb();
  const cfg = testSearchConfig(URL_, `${prefix}-stale`); // its own indices: its clocks are in the past
  const t = Date.now() - 60_000;
  db.clock = () => t;
  await ix.reconcile(db, cfg, ["works"]);
  const w = live(db)[2]!;
  // Another drain, which read the database later, has already written this work.
  await bulk(cfg, "works", [{ op: "index", id: w.id, doc: { id: w.id, stock_number: w.stock_number, title: "Newer than the drain", status: "in_stock", ledger: "jvb", web_visible: false, framed: false } }], { version: t + 30_000, refresh: true });
  db.clock = () => t + 15_000; // this drain claimed before that
  db.enqueue("work", w.id);
  const r = await ix.drainSearchOutbox(db, cfg);
  assert.deepEqual([r.status, r.superseded, r.done, r.left], ["ok", 1, 1, 0]);
  assert.equal(db.tables.search_outbox.length, 0);
  assert.deepEqual(await find("works", '"newer than the drain"', cfg), [w.id]);
  await dropIndices(`${prefix}-stale`);
});

test("drain: a read-only index blocks, and the rows stay for the next drain", { skip }, async () => {
  const db = new FakeDb();
  await ix.reconcile(db, cfg, ["makers"]);
  await os("PUT", `/${cfg.indices.makers}/_settings`, { "index.blocks.read_only_allow_delete": true });
  try {
    db.enqueue("maker", db.tables.makers[0].id);
    const r = await ix.drainSearchOutbox(db, cfg);
    assert.equal(r.status, "failed");
    assert.deepEqual([r.blocked, r.done, r.left], [1, 0, 1]);
    assert.equal(db.tables.search_outbox.length, 1, "the row stays; its claim lapses");
    assert.ok(db.tables.search_outbox[0].claimed_at);
    const s = await ix.searchStatus(db, cfg);
    assert.equal(s.engine, "read-only");
    assert.equal(s.indices.find((i: Row) => i.kind === "makers").readOnly, true);
  } finally {
    await os("PUT", `/${cfg.indices.makers}/_settings`, { "index.blocks.read_only_allow_delete": null });
  }
});

test("drain: a missing index is rebuilt by a reconcile first (self-heal)", { skip }, async (t) => {
  if (!refusesAutoCreate) {
    t.skip("this node auto-creates indices for the test prefix (production refuses with action.auto_create_index=-jvb-*,+*)");
    return;
  }
  const db = new FakeDb();
  await os("DELETE", `/${cfg.indices.contacts}`);
  const quennell = db.tables.crm_contacts.find((c: Row) => c.last_name === "Quennell");
  db.enqueue("contact", quennell.id);
  const r = await ix.drainSearchOutbox(db, cfg);
  assert.equal(r.status, "ok", JSON.stringify(r));
  assert.deepEqual(r.healed, ["contacts"]);
  assert.equal(r.done, 1);
  assert.equal(await countOf(cfg.indices.contacts), db.tables.crm_contacts.filter((c: Row) => !c.erased_at).length);
});

test("drain: not set up, and not configured", { skip }, async () => {
  const bare = new FakeDb({ setUp: false });
  assert.equal((await ix.drainSearchOutbox(bare, cfg)).status, "not set up");
  assert.equal((await ix.reconcile(bare, cfg)).status, "not set up");
  const s = await ix.searchStatus(bare, cfg);
  assert.equal(s.setUp, false);
  assert.equal(s.pending, null);

  const db = new FakeDb();
  db.enqueue("work", live(db)[0]!.id);
  db.enqueue("contact", db.tables.crm_contacts[0].id);
  const r = await ix.drainSearchOutbox(db, null);
  assert.deepEqual([r.status, r.claimed, r.done], ["not configured", 2, 2]);
  assert.equal(db.tables.search_outbox.length, 0, "discarded, so the outbox cannot grow while search is off");
  assert.equal((await ix.reconcile(db, null)).status, "not configured");
});

test("drain: a database failure leaves the claims to lapse", { skip }, async () => {
  const db = new FakeDb();
  db.enqueue("contact", db.tables.crm_contacts[0].id);
  db.failTables.add("crm_contacts");
  const r = await ix.drainSearchOutbox(db, cfg);
  assert.equal(r.status, "failed");
  assert.equal(r.left, 1);
  assert.equal(db.tables.search_outbox.length, 1);
  assert.ok(!/statement timeout/.test(r.error ?? ""), "database messages are not repeated");
});

test("erase: the contact leaves the index at once, and no stale write brings it back", { skip }, async () => {
  const db = new FakeDb();
  await ix.reconcile(db, cfg, ["contacts"]);
  const c = db.tables.crm_contacts.find((x: Row) => x.last_name === "Penhallow");
  assert.deepEqual(await find("contacts", "Penhallow"), [c.id]);
  assert.deepEqual(await ix.deleteContactFromIndex(cfg, c.id), { status: "deleted" });
  assert.deepEqual(await find("contacts", "Penhallow"), [], "gone at once (refresh=true)");
  // A drain that read the contact before the erasure arrives afterwards.
  const stale = await bulk(cfg, "contacts", [{ op: "index", id: c.id, doc: { id: c.id, last_name: "Penhallow" } }], { version: Date.now(), refresh: true });
  assert.equal(stale.items[0].result, "superseded");
  assert.deepEqual(await find("contacts", "Penhallow"), []);
  assert.deepEqual(await ix.deleteContactFromIndex(cfg, c.id), { status: "gone" });
  assert.deepEqual(await ix.deleteContactFromIndex(null, c.id), { status: "not configured" });
});

test("erase: on a read-only index the contacts index is dropped instead", { skip }, async () => {
  const db = new FakeDb();
  await ix.reconcile(db, cfg, ["contacts"]);
  await os("PUT", `/${cfg.indices.contacts}/_settings`, { "index.blocks.read_only_allow_delete": true });
  const c = db.tables.crm_contacts.find((x: Row) => x.last_name === "Quennell");
  const r = await ix.deleteContactFromIndex(cfg, c.id);
  assert.deepEqual(r, { status: "index dropped" });
  assert.equal(await exists(cfg.indices.contacts), false);
  // Search falls back to Postgres; the next reconcile recreates the index.
  const again = await ix.reconcile(db, cfg, ["contacts"]);
  assert.equal(again.kinds[0].created, true);
});

test("every request is a shape Caddy lets through, with the right account", { skip }, async () => {
  // The allow-list of docs/ops/opensearch-runbook.md (design section 1), with this run's prefix for "jvb".
  const p = `${prefix}-edge`.replace(/[-]/g, "\\-");
  const k = `${p}\\-(works|makers|contacts)\\-v[0-9]+`;
  const searchRule = { method: "POST", re: new RegExp(`^/${k}/_search$`) };
  const indexRules = [
    searchRule,
    { method: "POST", re: new RegExp(`^/${k}/_bulk(\\?refresh=(true|false))?$`) },
    { method: "PUT", re: new RegExp(`^/${k}$`) },
    { method: "DELETE", re: new RegExp(`^/${k}$`) },
    { method: "POST", re: new RegExp(`^/${k}/_refresh$`) },
    { method: "POST", re: new RegExp(`^/${k}/_forcemerge\\?only_expunge_deletes=true$`) },
    { method: "GET", re: new RegExp(`^/${k}/(_count|_mapping|_settings)$`) },
    { method: "GET", re: /^\/_cluster\/health$/ },
    { method: "GET", re: /^\/_cluster\/settings\?flat_settings=true$/ },
    { method: "GET", re: new RegExp(`^/_cat/indices/${p}-\\*\\?format=json&h=index,health,docs\\.count,docs\\.deleted,store\\.size$`) },
  ];
  const base = testSearchConfig(URL_, `${prefix}-edge`);
  const c = { ...base, search: { user: "jvb-search", password: "s" }, index: { user: "jvb-index", password: "i" } };
  const seen: { method: string; path: string; account: string; body: string }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const u = new URL(String(input));
    const auth = (init.headers as Record<string, string> | undefined)?.authorization ?? "";
    const account = Buffer.from(auth.replace(/^Basic /, ""), "base64").toString("utf8").split(":")[0] ?? "";
    seen.push({ method: init.method ?? "GET", path: u.pathname + u.search, account, body: typeof init.body === "string" ? init.body : "" });
    return real(input, init);
  }) as typeof fetch;
  try {
    const db = new FakeDb();
    await ix.reconcile(db, c);
    db.enqueue("maker", db.tables.makers[0].id);
    db.enqueue("organization", db.tables.crm_organizations[0].id);
    await ix.drainSearchOutbox(db, c);
    await ix.deleteContactFromIndex(c, db.tables.crm_contacts[0].id);
    await ix.searchStatus(db, c);
    // @ts-ignore TS5097
    const search = await import("./search.ts");
    search.setSearchConfigForTests(c);
    resetCircuit();
    await search.searchWorkIds(db, "Yosia", { roles: ["staff"], fuzzy: true, timeoutMs: 5000 });
    await search.searchContactIds(db, "Lucy", { roles: ["staff"], limit: 5, timeoutMs: 5000 });
    await search.searchMakerIds(db, "Yosai", { roles: ["staff"], limit: 5, timeoutMs: 5000 });
    search.setSearchConfigForTests(undefined);
  } finally {
    globalThis.fetch = real;
    await dropIndices(`${prefix}-edge`);
  }
  assert.ok(seen.length > 10);
  for (const r of seen) {
    const rules = r.account === "jvb-search" ? [searchRule] : r.account === "jvb-index" ? indexRules : [];
    assert.ok(rules.some((x) => x.method === r.method && x.re.test(r.path)), `${r.account || "no account"} ${r.method} ${r.path} is not on the allow-list`);
    // No index named in a body (the engine refuses one: rest.action.multi.allow_explicit_index=false).
    assert.ok(!r.body.includes('"_index"'), `${r.method} ${r.path} names an index in its body`);
  }
  assert.ok(seen.some((r) => r.account === "jvb-search"), "the helpers search with the search account");
  assert.ok(seen.filter((r) => r.path.endsWith("/_search") && r.account === "jvb-index").length > 0, "the reconcile lists ids with the index account");
});

test("status: engine, documents against the database, pending rows, last runs", { skip }, async () => {
  const db = new FakeDb();
  await ix.reconcile(db, cfg);
  db.enqueue("work", live(db)[0]!.id);
  const s = await ix.searchStatus(db, cfg);
  assert.equal(s.engine, "ok");
  assert.ok(s.health === "green" || s.health === "yellow");
  assert.equal(s.setUp, true);
  assert.equal(s.pending, 1);
  for (const i of s.indices) {
    assert.equal(i.exists, true, i.name);
    assert.equal(i.documents, i.database, `${i.kind}: index and database agree`);
  }
  assert.match(s.state.works?.lastResult ?? "", /^ok/);
  const none = await ix.searchStatus(db, null);
  assert.equal(none.engine, "not configured");
  assert.equal(none.pending, 1);
  const down = await ix.searchStatus(db, testSearchConfig("http://127.0.0.1:1", `${prefix}-down`));
  assert.equal(down.engine, "unreachable");
  assert.ok(down.problem && !down.problem.includes("127.0.0.1"));
});
