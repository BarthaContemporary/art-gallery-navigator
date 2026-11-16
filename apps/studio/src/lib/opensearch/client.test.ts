// node --test apps/studio/src/lib/opensearch/client.test.ts
// The client against a fake fetch: request shapes, result classes, and what is never logged.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { BULK_MAX_ACTIONS, bulk, chunkLines, describeFailures, listIndexedIds, MAX_HITS, osFetch, resetCircuit, searchHits, searchIds } from "./client.ts";
// @ts-ignore TS5097
import { searchConfig } from "./config.ts";

const cfg = searchConfig({
  OPENSEARCH_URL: "https://search.example.com",
  OPENSEARCH_SEARCH_USER: "jvb-search",
  OPENSEARCH_SEARCH_PASSWORD: "pw-search",
  OPENSEARCH_INDEX_USER: "jvb-index",
  OPENSEARCH_INDEX_PASSWORD: "pw-index",
})!;
const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined; cache?: string };
let calls: Call[] = [];
let reply: (call: Call) => Response | Promise<Response> = () => json(200, {});
const realFetch = globalThis.fetch;
const realError = console.error;
let logged: string[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  calls = [];
  logged = [];
  resetCircuit();
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method ?? "GET",
      headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])),
      body: typeof init.body === "string" ? init.body : undefined,
      cache: init.cache,
    };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

const hitsReply = (ids: string[], highlight?: Record<string, Record<string, string[]>>) =>
  json(200, { hits: { hits: ids.map((id) => ({ _index: "jvb-works-v1", _id: id, _score: 1, ...(highlight?.[id] ? { highlight: highlight[id] } : {}) })) } });

test("not configured: null, and no request at all", async () => {
  assert.equal(await searchIds(null, "works", { query: { match_all: {} } }), null);
  assert.equal(calls.length, 0);
});

test("a search: POST to the versioned index, no query string, ids only, search account, no-store", async () => {
  reply = () => hitsReply(["a", "b"]);
  const ids = await searchIds(cfg, "works", { query: { match: { title: "tea" } }, size: 3, _source: true }, { size: 12 });
  assert.deepEqual(ids, ["a", "b"]);
  const [c] = calls;
  assert.equal(c!.method, "POST");
  assert.equal(c!.url, "https://search.example.com/jvb-works-v1/_search");
  assert.equal(c!.headers.authorization, basic("jvb-search", "pw-search"));
  assert.equal(c!.cache, "no-store");
  const body = JSON.parse(c!.body!);
  assert.equal(body.size, 12);
  assert.equal(body._source, false);
  assert.equal(body.track_total_hits, false);
  assert.deepEqual(body.query, { match: { title: "tea" } });
});

test("size is capped at the engine's window, and at least 1", async () => {
  reply = () => hitsReply([]);
  await searchIds(cfg, "contacts", { query: {} }, { size: MAX_HITS + 5000 });
  await searchIds(cfg, "contacts", { query: {} }, { size: 0 });
  assert.equal(JSON.parse(calls[0]!.body!).size, MAX_HITS);
  assert.equal(JSON.parse(calls[1]!.body!).size, 1);
  assert.equal(calls[0]!.url, "https://search.example.com/jvb-contacts-v1/_search");
});

test("highlights name the fields, never carry their text out", async () => {
  reply = () => hitsReply(["a", "b"], { a: { provenance: ["Collection of Mr Smith"] } });
  const hits = await searchHits(cfg, "works", { query: {} });
  assert.deepEqual(hits, [{ id: "a", fields: ["provenance"] }, { id: "b", fields: [] }]);
  assert.ok(!JSON.stringify(hits).includes("Smith"));
});

test("a missing index is null and does not cool off; an outage cools off for 30 s", async () => {
  reply = () => json(404, { error: { type: "index_not_found_exception", reason: "no such index [jvb-works-v1]" } });
  assert.equal(await searchIds(cfg, "works", { query: {} }), null);
  assert.equal(await searchIds(cfg, "works", { query: {} }), null);
  assert.equal(calls.length, 2);
  assert.equal(logged.length, 0, "a missing index is a normal state");

  reply = () => json(503, { error: { type: "cluster_block_exception", reason: "secret reason" } });
  let t = 1_000_000;
  const now = () => t;
  assert.equal(await searchIds(cfg, "works", { query: {} }, { now }), null);
  assert.equal(await searchIds(cfg, "works", { query: {} }, { now }), null);
  assert.equal(calls.length, 3, "the second call is skipped during the cool-off");
  t += 31_000;
  reply = () => hitsReply(["x"]);
  assert.deepEqual(await searchIds(cfg, "works", { query: {} }, { now }), ["x"]);
});

test("a refused query (400) is null without cooling off", async () => {
  reply = () => json(400, { error: { type: "parsing_exception", reason: "bad" } });
  assert.equal(await searchIds(cfg, "works", { query: {} }), null);
  assert.equal(await searchIds(cfg, "works", { query: {} }), null);
  assert.equal(calls.length, 2);
});

test("a timeout or a network failure is null, never a throw", async () => {
  reply = () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };
  assert.equal(await searchIds(cfg, "works", { query: {} }), null);
  resetCircuit();
  reply = () => {
    throw new TypeError("fetch failed");
  };
  assert.equal(await searchIds(cfg, "makers", { query: {} }), null);
  const r = await osFetch(cfg, "index", "GET", "/_cluster/health");
  assert.deepEqual(r.error, { status: 0, type: "unreachable" });
});

test("nothing logged carries a query, a reason or a password", async () => {
  reply = () => json(500, { error: { type: "search_phase_execution_exception", reason: "failed on Hiroshi Tanaka h.tanaka@example.jp", caused_by: { reason: "x" } } });
  await searchIds(cfg, "contacts", { query: { match: { all: "Hiroshi Tanaka" } } });
  assert.equal(logged.length, 1);
  const line = logged[0]!;
  assert.match(line, /500 search_phase_execution_exception/);
  for (const secret of ["Hiroshi", "Tanaka", "example.jp", "pw-search", "caused_by"]) assert.ok(!line.includes(secret), line);
});

test("osFetch keeps only status and type of an error", async () => {
  reply = () => json(403, { error: { type: "index_create_block_exception", reason: "blocked by: [FORBIDDEN/10/cluster create-index blocked (api)]" } });
  const r = await osFetch(cfg, "index", "PUT", "/jvb-works-v1", { settings: {} });
  assert.deepEqual(r, { status: 403, json: null, error: { status: 403, type: "index_create_block_exception" } });
  assert.equal(calls[0]!.headers.authorization, basic("jvb-index", "pw-index"));
  reply = () => json(500, { error: { type: "Not A Type <script>" } });
  assert.equal((await osFetch(cfg, "index", "GET", "/_cluster/health")).error?.type, "http_500");
});

function bulkReply(statuses: [op: string, status: number, type?: string][]) {
  return json(200, {
    errors: statuses.some(([, s]) => s >= 300),
    items: statuses.map(([op, status, type], i) => ({ [op]: { _id: String(i), status, ...(type ? { error: { type, reason: "Preview of field's value: 'Hiroshi Tanaka'" } } : {}) } })),
  });
}

test("bulk: index account, NDJSON, external_gte versions, no _index in action lines", async () => {
  reply = () => bulkReply([["index", 201], ["delete", 200]]);
  const r = await bulk(cfg, "works", [{ op: "index", id: "w1", doc: { id: "w1", title: "Tea bowl" } }, { op: "delete", id: "w2" }], { version: 1700000000123, refresh: true });
  assert.equal(r.ok, 2);
  const c = calls[0]!;
  assert.equal(c.url, "https://search.example.com/jvb-works-v1/_bulk?refresh=true");
  assert.equal(c.headers["content-type"], "application/x-ndjson");
  assert.equal(c.headers.authorization, basic("jvb-index", "pw-index"));
  assert.ok(c.body!.endsWith("\n"));
  const lines = c.body!.trimEnd().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines, [
    { index: { _id: "w1", version: 1700000000123, version_type: "external_gte" } },
    { id: "w1", title: "Tea bowl" },
    { delete: { _id: "w2", version: 1700000000123, version_type: "external_gte" } },
  ]);
  assert.ok(!c.body!.includes("_index"));
  await bulk(cfg, "makers", [{ op: "delete", id: "m" }], { version: 1 });
  assert.equal(calls[1]!.url, "https://search.example.com/jvb-makers-v1/_bulk?refresh=false");
});

test("bulk results: ok, superseded (409), gone (404 delete), blocked (429), failed, index missing", async () => {
  reply = () =>
    bulkReply([
      ["index", 201],
      ["index", 409, "version_conflict_engine_exception"],
      ["delete", 404],
      ["delete", 409, "version_conflict_engine_exception"],
      ["index", 429, "cluster_block_exception"],
      ["index", 400, "strict_dynamic_mapping_exception"],
      ["delete", 404, "index_not_found_exception"],
    ]);
  const actions = Array.from({ length: 7 }, (_, i) => (i === 2 || i === 3 || i === 6 ? { op: "delete" as const, id: `d${i}` } : { op: "index" as const, id: `d${i}`, doc: { id: `d${i}` } }));
  const r = await bulk(cfg, "contacts", actions, { version: 5 });
  assert.deepEqual(r.items.map((i: { result: string }) => i.result), ["ok", "superseded", "gone", "superseded", "blocked", "failed", "failed"]);
  assert.deepEqual([r.ok, r.superseded, r.gone, r.blocked, r.failed], [1, 2, 1, 1, 2]);
  assert.equal(r.indexMissing, true);
  assert.equal(r.items[5].type, "strict_dynamic_mapping_exception");
  const d = describeFailures(r);
  assert.match(d, /2 failed, 1 blocked/);
  assert.ok(!d.includes("Hiroshi") && !JSON.stringify(r).includes("Hiroshi"), "reasons are dropped");
});

test("bulk: a request that fails as a whole gives every action its outcome", async () => {
  reply = () => {
    throw new TypeError("fetch failed");
  };
  let r = await bulk(cfg, "works", [{ op: "delete", id: "a" }, { op: "index", id: "b", doc: {} }], { version: 1 });
  assert.deepEqual(r.items.map((i: { result: string; type?: string }) => [i.result, i.type]), [["failed", "unreachable"], ["failed", "unreachable"]]);
  reply = () => json(429, { error: { type: "cluster_block_exception" } });
  r = await bulk(cfg, "works", [{ op: "delete", id: "a" }], { version: 1 });
  assert.equal(r.items[0].result, "blocked");
  reply = () => json(404, { error: { type: "index_not_found_exception" } });
  r = await bulk(cfg, "works", [{ op: "delete", id: "a" }], { version: 1 });
  assert.equal(r.items[0].result, "failed", "a missing index is not a document already gone");
  assert.equal(r.indexMissing, true);
  // A 200 that is not a bulk answer (a proxy page, a truncated body) is a failure, never a success.
  reply = () => new Response("<html>ok</html>", { status: 200 });
  r = await bulk(cfg, "works", [{ op: "delete", id: "a" }, { op: "index", id: "b", doc: {} }], { version: 1 });
  assert.deepEqual(r.items.map((i: { result: string }) => i.result), ["failed", "failed"]);
  reply = () => json(200, { items: [{ index: { status: 201 } }] }); // fewer items than actions
  r = await bulk(cfg, "works", [{ op: "delete", id: "a" }, { op: "index", id: "b", doc: {} }], { version: 1 });
  assert.deepEqual([r.ok, r.failed], [0, 2]);
});

test("bulk chunks at 500 actions and at 5 MB, one index per request", async () => {
  reply = (c) => {
    const n = c.body!.trimEnd().split("\n").filter((l) => l.startsWith('{"delete"') || l.startsWith('{"index"')).length;
    return bulkReply(Array.from({ length: n }, () => ["index", 201] as [string, number]));
  };
  const many = Array.from({ length: 1201 }, (_, i) => ({ op: "index" as const, id: `w${i}`, doc: { id: `w${i}` } }));
  const r = await bulk(cfg, "works", many, { version: 1 });
  assert.equal(r.ok, 1201);
  assert.equal(calls.length, 3);
  assert.equal(BULK_MAX_ACTIONS, 500);
  calls = [];
  const big = Array.from({ length: 12 }, (_, i) => ({ op: "index" as const, id: `b${i}`, doc: { id: `b${i}`, description: "x".repeat(1_000_000) } }));
  await bulk(cfg, "works", big, { version: 1 });
  assert.equal(calls.length, 3, "12 MB of documents in requests under 5 MB");
  for (const c of calls) assert.ok(Buffer.byteLength(c.body!) <= 5 * 1024 * 1024);
  assert.ok(calls.every((c) => c.url.startsWith("https://search.example.com/jvb-works-v1/_bulk")));
  // A single oversized document still goes, alone.
  assert.deepEqual(chunkLines([{ bytes: 10 }, { bytes: 6_000_000 }, { bytes: 10 }]).map((c: unknown[]) => c.length), [1, 1, 1]);
});

test("bulk refuses a version that is not a safe integer", async () => {
  await assert.rejects(bulk(cfg, "works", [{ op: "delete", id: "a" }], { version: 1.5 }));
  await assert.rejects(bulk(cfg, "works", [{ op: "delete", id: "a" }], { version: Number.MAX_SAFE_INTEGER + 2 }));
});

test("listing ids pages with search_after on the id keyword (index account)", async () => {
  reply = (c) => {
    const b = JSON.parse(c.body!);
    const after = b.search_after?.[0];
    const all = ["a", "b", "c", "d", "e"];
    const start = after ? all.indexOf(after) + 1 : 0;
    const page = all.slice(start, start + b.size);
    return json(200, { hits: { hits: page.map((id) => ({ _id: id, sort: [id] })) } });
  };
  assert.deepEqual(await listIndexedIds(cfg, "contacts", { page: 2 }), ["a", "b", "c", "d", "e"]);
  assert.equal(calls.length, 3);
  assert.equal(calls[0]!.headers.authorization, basic("jvb-index", "pw-index"));
  assert.deepEqual(JSON.parse(calls[0]!.body!).sort, [{ id: "asc" }]);
  reply = () => json(500, { error: { type: "x" } });
  await assert.rejects(listIndexedIds(cfg, "works"), /500 x/);
});
