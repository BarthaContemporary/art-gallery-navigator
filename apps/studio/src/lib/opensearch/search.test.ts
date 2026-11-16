// node --test apps/studio/src/lib/opensearch/search.test.ts
// The search helpers with a fake Postgres (fixtures) and a fake OpenSearch: roles, merge, passes, labels.
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports } from "./test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { testSearchConfig } from "./config.ts";
// @ts-ignore TS5097
import { resetCircuit } from "./client.ts";

allowStudioImports();
type SearchModule = typeof import("./search");
let search: SearchModule;
before(async () => {
  // @ts-ignore TS5097
  search = (await import("./search.ts")) as SearchModule;
});

const cfg = testSearchConfig("http://127.0.0.1:1", "oslib-unit");
type Body = Record<string, unknown>;
let requests: { url: string; body: Body }[] = [];
let answer: (body: Body, url: string) => unknown = () => ({ hits: { hits: [] } });
const realFetch = globalThis.fetch;
const realError = console.error;

beforeEach(() => {
  requests = [];
  resetCircuit();
  search.setSearchConfigForTests(cfg);
  console.error = () => {};
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const body = JSON.parse(String(init.body ?? "{}")) as Body;
    requests.push({ url: String(input), body });
    const out = answer(body, String(input));
    if (out instanceof Error) throw out;
    return new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  search.setSearchConfigForTests(undefined);
});

const hits = (...ids: (string | [string, string[]])[]) => ({
  hits: { hits: ids.map((x) => (Array.isArray(x) ? { _id: x[0], highlight: Object.fromEntries(x[1].map((f) => [f, ["…"]])) } : { _id: x })) },
});
const isFuzzy = (b: Body) => JSON.stringify(b).includes("fuzziness");

test("the accountant and users with no role never reach OpenSearch; Postgres answers as today", async () => {
  const db = new FakeDb();
  for (const roles of [["accountant"], [], ["capture"]]) {
    const w = await search.searchWorkIds(db as never, "2024-0003", { roles, fuzzy: true });
    assert.ok(w.ids.length >= 1);
    assert.equal(w.similar, false);
    await search.searchContactIds(db as never, "Lucy", { roles, limit: 10, fuzzy: true });
    await search.searchMakerIds(db as never, "Yosai", { roles, limit: 4, fuzzy: true });
  }
  assert.equal(requests.length, 0);
});

test("not configured: Postgres only, in its own order", async () => {
  search.setSearchConfigForTests(null);
  const db = new FakeDb();
  const r = await search.searchWorkIds(db as never, "0003", { roles: ["admin"] });
  assert.equal(requests.length, 0);
  const pg = (await db.rpc("pieces_search", { q: "0003" }).select("id")) as { data: { id: string }[] };
  assert.deepEqual(r.ids, pg.data.map((x) => x.id));
});

test("works: the stock-number hit leads, then OpenSearch's order, then the rest of Postgres", async () => {
  const db = new FakeDb();
  const exact = db.tables.pieces.find((p: { stock_number: string }) => p.stock_number === "2024-0003").id;
  answer = () => hits("os-only-1", exact, "os-only-2");
  const r = await search.searchWorkIds(db as never, "2024-0003", { roles: ["staff"], size: 12, timeoutMs: 600 });
  assert.deepEqual(r.ids.slice(0, 3), [exact, "os-only-1", "os-only-2"]);
  assert.equal(new Set(r.ids).size, r.ids.length);
  assert.equal(requests.length, 1);
  assert.ok(requests[0]!.url.endsWith("/oslib-unit-works-v1/_search"));
  assert.equal(requests[0]!.body.size, 12);
  assert.ok(requests[0]!.body.highlight, "the strict works pass asks for highlights, to name the field");
  assert.equal(isFuzzy(requests[0]!.body), false);
});

test("works: 'matched' labels a hit found outside the title, maker and stock number", async () => {
  const db = new FakeDb();
  answer = () => hits(["w-prov", ["provenance"]], ["w-title", ["title", "provenance"]], "w-plain");
  const r = await search.searchWorkIds(db as never, "artist", { roles: ["admin"] });
  assert.deepEqual(r.matched, { "w-prov": "provenance" });
});

test("fuzzy: only when strict and Postgres found nothing, labelled similar; never when OpenSearch is down", async () => {
  const db = new FakeDb();
  answer = (b) => (isFuzzy(b) ? hits("yosai-1", "yosai-2") : hits());
  let r = await search.searchWorkIds(db as never, "Yosia", { roles: ["staff"], fuzzy: true });
  assert.deepEqual(r, { ids: ["yosai-1", "yosai-2"], error: null, similar: true });
  assert.equal(requests.length, 2);
  // Without `fuzzy`, no second pass.
  requests = [];
  r = await search.searchWorkIds(db as never, "Yosia", { roles: ["staff"] });
  assert.deepEqual(r.ids, []);
  assert.equal(requests.length, 1);
  // Something found: no second pass.
  requests = [];
  answer = (b) => (isFuzzy(b) ? hits("x") : hits("strict-hit"));
  r = await search.searchWorkIds(db as never, "zzzz", { roles: ["staff"], fuzzy: true });
  assert.deepEqual(r, { ids: ["strict-hit"], error: null, similar: false });
  // OpenSearch unreachable: Postgres only, no fuzzy attempt.
  requests = [];
  answer = () => new TypeError("fetch failed");
  r = await search.searchWorkIds(db as never, "zzzz", { roles: ["staff"], fuzzy: true });
  assert.deepEqual(r, { ids: [], error: null, similar: false });
  assert.equal(requests.length, 1);
});

test("a Postgres error comes back in supabase-js's shape", async () => {
  const db = new FakeDb();
  db.callRpc = () => ({ data: null, error: { message: "boom", code: "XX000" }, status: 500 });
  answer = () => hits("a");
  const r = await search.searchWorkIds(db as never, "tea", { roles: ["admin"] });
  assert.deepEqual(r.ids, []);
  assert.equal(r.error?.message, "boom");
});

test("contacts: OpenSearch first, then Postgres, at most `limit`", async () => {
  const db = new FakeDb();
  answer = () => hits("os-1", "os-2");
  const r = await search.searchContactIds(db as never, "Lucy", { roles: ["staff"], limit: 3 });
  assert.equal(r.ids.length, 3);
  assert.deepEqual(r.ids.slice(0, 2), ["os-1", "os-2"]);
  assert.ok(requests[0]!.url.endsWith("/oslib-unit-contacts-v1/_search"));
  assert.equal(requests[0]!.body.size, 3);
  assert.equal(requests[0]!.body.highlight, undefined, "nothing is ever shown from the contacts index");
});

test("makers: Postgres ILIKE over names, region and school, merged after OpenSearch", async () => {
  const db = new FakeDb();
  answer = () => hits("os-maker");
  const r = await search.searchMakerIds(db as never, "Yosai", { roles: ["admin"], limit: 4 });
  assert.equal(r.ids[0], "os-maker");
  assert.ok(r.ids.includes("3a6e0000-0002-4000-8000-3a6e00000000"), "Yokota Yōsai by its romanized name");
  // A filter metacharacter cannot add filter nodes.
  const s = await search.searchMakerIds(db as never, "a,b)", { roles: ["accountant"], limit: 4 });
  assert.equal(s.error, null);
});

test("blank input asks nothing of anyone", async () => {
  const db = new FakeDb();
  for (const q of ["", "   "]) {
    assert.deepEqual(await search.searchWorkIds(db as never, q, { roles: ["admin"] }), { ids: [], error: null, similar: false });
    assert.deepEqual(await search.searchContactIds(db as never, q, { roles: ["admin"], limit: 5 }), { ids: [], error: null, similar: false });
  }
  assert.equal(db.calls.length, 0);
  assert.equal(requests.length, 0);
});
