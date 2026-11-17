// node --test apps/studio/src/lib/search-routes.test.ts
// The search sync and reconcile routes without Next.js or a node: the secret
// checks, OpenSearch not configured, migration 0100 absent, and what the
// answers carry. (The drain and reconcile themselves: opensearch/indexer.test.ts.)
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, FakeOpenSearch, allowStudioImports } from "./opensearch/test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { testSearchConfig } from "./opensearch/config.ts";

allowStudioImports();
type Routes = typeof import("./search-routes");
let routes: Routes;
before(async () => {
  // @ts-ignore TS5097
  routes = (await import("./search-routes.ts")) as Routes;
});

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-routes");
const ENV = { CRON_SECRET: "cron-secret-1", SYNC_SHARED_SECRET: "shared-secret-1" };
const DB_SECRET = "database-secret-1";

/** FakeDb plus the one sync_config read the pg_net secret check makes. */
function makeDb(opts: Row = {}): Row {
  const db = new FakeDb(opts);
  const from = db.from.bind(db);
  db.syncConfigReads = 0;
  db.from = (table: string) => {
    if (table !== "sync_config") return from(table);
    db.syncConfigReads += 1;
    const answer = { data: opts.dbSecret === null ? null : { secret: opts.dbSecret ?? DB_SECRET }, error: null };
    const q = { select: () => q, eq: () => q, maybeSingle: async () => answer };
    return q;
  };
  return db;
}

/** The dependencies a route builds, with a count of service clients made. */
function deps(db: Row, config: unknown = cfg, env: Row = ENV) {
  const made = { clients: 0 };
  return { made, deps: { service: () => (made.clients++, db), cfg: config, env } as never };
}

const post = (secret?: string) =>
  new Request("http://studio.test/api/sync/search", {
    method: "POST",
    headers: secret === undefined ? {} : { "x-sync-secret": secret, "x-sync-source": "outbox" },
  });
const get = (path: string, authorization?: string) =>
  new Request(`http://studio.test${path}`, { headers: authorization === undefined ? {} : { authorization } });

let requests: string[] = [];
let logged: string[] = [];
const realFetch = globalThis.fetch;
const realError = console.error;
beforeEach(() => {
  requests = [];
  logged = [];
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  // No OpenSearch unless a test installs the fake: any request is recorded and refused.
  globalThis.fetch = (async (input: string | URL) => {
    requests.push(String(input));
    throw new Error("no network in this test");
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

const live = (db: Row) => (db.rowsOf("vw_pieces_all") as Row[]).filter((p) => !p.deleted_at);

// ------------------------------------------------------------------ secrets

test("cron routes: no CRON_SECRET, or a missing, wrong or non-Bearer header, is 401 before any client is made", async () => {
  const db = makeDb();
  db.enqueue("work", live(db)[0]!.id);
  const cases: [string | undefined, Row][] = [
    [undefined, ENV],
    ["Bearer wrong", ENV],
    [`Basic ${ENV.CRON_SECRET}`, ENV],
    [ENV.CRON_SECRET, ENV],
    ["Bearer ", { ...ENV, CRON_SECRET: "" }],
    ["Bearer undefined", { SYNC_SHARED_SECRET: ENV.SYNC_SHARED_SECRET }],
  ];
  for (const [authorization, env] of cases) {
    for (const [path, run] of [
      ["/api/sync/search", routes.drainFromCron],
      ["/api/cron/search-reconcile", routes.reconcileFromCron],
    ] as const) {
      const { made, deps: d } = deps(db, cfg, env);
      const res = await run(get(path, authorization), d);
      assert.equal(res.status, 401, `${path} with ${authorization ?? "no header"}`);
      assert.deepEqual(await res.json(), { error: "unauthorized" });
      assert.equal(made.clients, 0);
    }
  }
  assert.equal(db.tables.search_outbox.length, 1, "nothing was claimed");
  assert.equal(requests.length, 0);
});

test("the pg_net POST: no secret or a wrong one is 401; SYNC_SHARED_SECRET or sync_config's secret drains", async () => {
  const db = makeDb();
  for (const secret of [undefined, "", "wrong", `${DB_SECRET}x`, ENV.CRON_SECRET]) {
    const { deps: d } = deps(db, null);
    const res = await routes.drainFromDatabase(post(secret), d);
    assert.equal(res.status, 401, `secret ${JSON.stringify(secret)}`);
  }
  assert.equal(db.calls.filter((c: Row) => c.rpc === "claim_search_outbox").length, 0, "nothing claimed while refused");

  // The env secret answers without reading sync_config; the database one reads it.
  let { deps: d } = deps(db, null);
  let res = await routes.drainFromDatabase(post(ENV.SYNC_SHARED_SECRET), d);
  assert.equal(res.status, 200);
  const reads = db.syncConfigReads;
  ({ deps: d } = deps(db, null, {}));
  res = await routes.drainFromDatabase(post(DB_SECRET), d);
  assert.equal(res.status, 200);
  assert.equal(db.syncConfigReads, reads + 1);

  // No secret in sync_config and none in the environment: nothing opens it.
  const empty = makeDb({ dbSecret: null });
  ({ deps: d } = deps(empty, null, {}));
  assert.equal((await routes.drainFromDatabase(post(""), d)).status, 401);
  assert.equal((await routes.drainFromDatabase(post("anything"), d)).status, 401);
});

test("the cron secret also opens the drain GET", async () => {
  const db = makeDb();
  const { made, deps: d } = deps(db, null);
  const res = await routes.drainFromCron(get("/api/sync/search", `Bearer ${ENV.CRON_SECRET}`), d);
  assert.equal(res.status, 200);
  assert.equal(made.clients, 1);
});

// ------------------------------------------------------------------ the states before search is live

test("migration 0100 absent: 200 { skipped: 'not set up' } from every route, configured or not, and nothing is sent", async () => {
  for (const config of [null, cfg]) {
    const db = makeDb({ setUp: false });
    const { deps: d } = deps(db, config);
    for (const res of [
      await routes.drainFromDatabase(post(ENV.SYNC_SHARED_SECRET), d),
      await routes.drainFromCron(get("/api/sync/search", `Bearer ${ENV.CRON_SECRET}`), d),
    ]) {
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { skipped: "not set up" });
    }
    if (config) {
      const res = await routes.reconcileFromCron(get("/api/cron/search-reconcile", `Bearer ${ENV.CRON_SECRET}`), d);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { skipped: "not set up" });
    }
  }
  assert.equal(requests.length, 0);
  assert.deepEqual(logged, []);
});

test("OpenSearch not configured: the drain claims and discards; the reconcile touches nothing; misconfigured says so", async () => {
  const db = makeDb();
  for (const p of live(db).slice(0, 3)) db.enqueue("work", p.id);
  db.enqueue("contact", (db.tables.crm_contacts as Row[])[0]!.id);
  const { deps: d } = deps(db, null);
  let res = await routes.drainFromDatabase(post(ENV.SYNC_SHARED_SECRET), d);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { skipped: "not configured", discarded: 4 });
  assert.equal(db.tables.search_outbox.length, 0, "the outbox cannot grow while search is off");

  // Nothing queued: still a quiet skip.
  res = await routes.drainFromCron(get("/api/sync/search", `Bearer ${ENV.CRON_SECRET}`), d);
  assert.deepEqual(await res.json(), { skipped: "not configured", discarded: 0 });

  const calls = db.calls.length;
  const { made, deps: r } = deps(db, null);
  res = await routes.reconcileFromCron(get("/api/cron/search-reconcile", `Bearer ${ENV.CRON_SECRET}`), r);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { skipped: "not configured" });
  assert.equal(made.clients, 0);
  assert.equal(db.calls.length, calls, "no database call");

  // Set but unusable (searchConfig gave null): named, so the cron log shows why.
  const { deps: bad } = deps(db, null, { ...ENV, OPENSEARCH_URL: "http://search.example.com" });
  res = await routes.reconcileFromCron(get("/api/cron/search-reconcile", `Bearer ${ENV.CRON_SECRET}`), bad);
  assert.deepEqual(await res.json(), { skipped: "misconfigured" });
  res = await routes.drainFromCron(get("/api/sync/search", `Bearer ${ENV.CRON_SECRET}`), bad);
  assert.deepEqual(await res.json(), { skipped: "misconfigured", discarded: 0 });
  assert.equal(requests.length, 0);
});

// ------------------------------------------------------------------ configured (a fake node)

test("configured: the nightly reconcile fills the indices, then the wake-up drains a change at the route's batch", async () => {
  const os = new FakeOpenSearch().install();
  try {
    const db = makeDb();
    const { deps: d } = deps(db, cfg);
    let res = await routes.reconcileFromCron(get("/api/cron/search-reconcile", `Bearer ${ENV.CRON_SECRET}`), d);
    let body = (await res.json()) as Row;
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.status, "ok");
    assert.deepEqual(body.kinds.map((k: Row) => [k.kind, k.status, k.created]), [
      ["works", "ok", true],
      ["makers", "ok", true],
      ["contacts", "ok", true],
    ]);
    assert.deepEqual(os.ids(cfg.indices.works), live(db).map((p) => p.id).sort());

    const work = (db.tables.pieces as Row[]).find((p) => !p.deleted_at)!;
    work.title = "Renamed for the drain test";
    db.enqueue("work", work.id);
    res = await routes.drainFromDatabase(post(ENV.SYNC_SHARED_SECRET), d);
    body = (await res.json()) as Row;
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.deepEqual([body.status, body.claimed, body.done, body.left, body.written], ["ok", 1, 1, 0, 1]);
    assert.equal(os.indices.get(cfg.indices.works).docs.get(work.id).doc.title, "Renamed for the drain test");
    assert.equal(db.tables.search_outbox.length, 0);
    const claims = db.calls.filter((c: Row) => c.rpc === "claim_search_outbox");
    assert.deepEqual(claims[0].args, { batch: routes.DRAIN_BATCH });
    assert.ok(routes.DRAIN_BATCH * routes.DRAIN_ROUNDS <= 2000, "a call stays inside its time limit");
  } finally {
    os.restore();
  }
});

test("a blocked reconcile (disk nearly full) is a 502 the cron log shows, with the error type and no reason", async () => {
  const os = new FakeOpenSearch().install();
  os.intercept = (method: string) =>
    method === "PUT"
      ? new Response(JSON.stringify({ error: { type: "index_create_block_exception", reason: "blocked by: [FORBIDDEN/10/cluster create-index blocked]" } }), { status: 403 })
      : undefined;
  try {
    const db = makeDb();
    const { deps: d } = deps(db, cfg);
    const res = await routes.reconcileFromCron(get("/api/cron/search-reconcile", `Bearer ${ENV.CRON_SECRET}`), d);
    const text = await res.text();
    assert.equal(res.status, 502);
    const body = JSON.parse(text) as Row;
    assert.equal(body.status, "blocked");
    assert.equal(body.kinds[0].status, "blocked");
    assert.doesNotMatch(text, /FORBIDDEN|create-index blocked/);
  } finally {
    os.restore();
  }
});

test("a failing drain is a 502 with the database code only; an unexpected throw is a 500 with nothing quoted", async () => {
  const sentinel = "Jane Q. Private";
  const db = makeDb();
  db.enqueue("work", live(db)[0]!.id);
  const realRpc = db.callRpc.bind(db);
  db.callRpc = (name: string, args: Row) =>
    name === "claim_search_outbox"
      ? { data: null, error: { code: "57014", message: `canceling statement: ${sentinel}` }, status: 500 }
      : realRpc(name, args);
  let { deps: d } = deps(db, cfg);
  let res = await routes.drainFromDatabase(post(ENV.SYNC_SHARED_SECRET), d);
  let text = await res.text();
  assert.equal(res.status, 502);
  assert.equal((JSON.parse(text) as Row).error, "claim_search_outbox failed (57014)");
  assert.ok(!text.includes(sentinel));

  const throwing = makeDb();
  throwing.rpc = () => {
    throw new Error(`boom ${sentinel}`);
  };
  ({ deps: d } = deps(throwing, cfg));
  res = await routes.drainFromCron(get("/api/sync/search", `Bearer ${ENV.CRON_SECRET}`), d);
  text = await res.text();
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(text), { error: "drain failed" });
  res = await routes.reconcileFromCron(get("/api/cron/search-reconcile", `Bearer ${ENV.CRON_SECRET}`), d);
  text = await res.text();
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(text), { error: "reconcile failed" });
  assert.ok(logged.length > 0 && logged.every((l) => !l.includes(sentinel)), "nothing quoted in the log");
});
