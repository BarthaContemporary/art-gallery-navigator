// Against a local OpenSearch (security off), with this run's own index prefix:
//   OPENSEARCH_TEST_URL=http://127.0.0.1:9209 node --test apps/studio/src/lib/search-routes.int.test.ts
// Without the variable every test here is skipped.
//
// The two routes end to end over the fixtures (a fake service client that
// provides migration 0100's objects): the nightly reconcile fills the
// indices, the database's wake-up drains an edit, the cron drains an erasure.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports, assertNodeCanCreate, dropIndices, os, skipWithoutNode as skip, testPrefix } from "./opensearch/test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { testSearchConfig } from "./opensearch/config.ts";
// @ts-ignore TS5097
import { resetCircuit, searchIds } from "./opensearch/client.ts";
// @ts-ignore TS5097
import { buildSearch } from "./opensearch/query.ts";

allowStudioImports();
type Routes = typeof import("./search-routes");
let routes: Routes;
const prefix = testPrefix("routes");
const cfg = testSearchConfig(process.env.OPENSEARCH_TEST_URL || "http://127.0.0.1:1", prefix);
const ENV = { CRON_SECRET: "cron-secret-int", SYNC_SHARED_SECRET: "shared-secret-int" };
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

before(async () => {
  // @ts-ignore TS5097
  routes = (await import("./search-routes.ts")) as Routes;
  if (skip) return;
  await assertNodeCanCreate(prefix);
});
after(async () => {
  if (!skip) await dropIndices(prefix);
});

const cron = (path: string) => new Request(`http://studio.test${path}`, { headers: { authorization: `Bearer ${ENV.CRON_SECRET}` } });
const wakeUp = () =>
  new Request("http://studio.test/api/sync/search", {
    method: "POST",
    headers: { "x-sync-secret": ENV.SYNC_SHARED_SECRET, "x-sync-source": "outbox" },
  });
const find = async (kind: "works" | "makers" | "contacts", q: string) => {
  resetCircuit();
  return (await searchIds(cfg, kind, buildSearch(kind, q)!, { size: 50, timeoutMs: 5000 })) ?? [];
};
const countOf = async (name: string) => {
  await os("POST", `/${name}/_refresh`);
  return (await os("GET", `/${name}/_count`)).json?.count;
};

test("reconcile route fills the indices; the wake-up drains an edit; the cron drains an erasure", { skip }, async () => {
  const db = new FakeDb();
  const d = { service: () => db, cfg, env: ENV } as never;

  let res = await routes.reconcileFromCron(cron("/api/cron/search-reconcile"), d);
  let body = (await res.json()) as Row;
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.deepEqual(body.kinds.map((k: Row) => k.status), ["ok", "ok", "ok"]);
  const live = (db.rowsOf("vw_pieces_all") as Row[]).filter((p) => !p.deleted_at);
  const contacts = (db.tables.crm_contacts as Row[]).filter((c) => !c.erased_at);
  assert.equal(await countOf(cfg.indices.works), live.length);
  assert.equal(await countOf(cfg.indices.makers), db.tables.makers.length);
  assert.equal(await countOf(cfg.indices.contacts), contacts.length);

  // An edit, queued as the 0100 trigger would, reaches the index through the POST.
  const work = (db.tables.pieces as Row[]).find((p) => !p.deleted_at)!;
  work.title = "Quixotically zircon netsuke";
  db.enqueue("work", work.id);
  res = await routes.drainFromDatabase(wakeUp(), d);
  body = (await res.json()) as Row;
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.deepEqual([body.status, body.done, body.written], ["ok", 1, 1]);
  assert.deepEqual(await find("works", "zircon"), [work.id]);

  // An erasure the action could not remove at once: the cron's drain removes it.
  const gone = contacts[0]!;
  gone.erased_at = new Date().toISOString();
  db.enqueue("contact", gone.id);
  res = await routes.drainFromCron(cron("/api/sync/search"), d);
  body = (await res.json()) as Row;
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.deepEqual([body.status, body.done], ["ok", 1]);
  assert.equal(await countOf(cfg.indices.contacts), contacts.length - 1);
  assert.equal(db.tables.search_outbox.length, 0);
});
