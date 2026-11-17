// The palette's search against a local OpenSearch (security off), with this run's own index prefix:
//   OPENSEARCH_TEST_URL=http://127.0.0.1:9209 node --test apps/studio/src/lib/palette-search.int.test.ts
// Without the variable every test here is skipped, so `pnpm test:unit` stays self-contained.
//
// The three indices from mappings.ts, filled from the fixtures
// (scripts/studio-preview/fixtures/data) as the drain would fill them;
// Postgres is test-support's FakeDb with vw_pieces_list beside it. The
// route's own call: paletteSearch, for staff and for the accountant.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports, assertNodeCanCreate, dropIndices, os, skipWithoutNode as skip, testPrefix } from "./opensearch/test-support.mjs";

allowStudioImports();
// @ts-ignore TS5097
const { INDEX_VERSION, SEARCH_KINDS, testSearchConfig } = await import("./opensearch/config.ts");
// @ts-ignore TS5097
const { bulk, resetCircuit } = await import("./opensearch/client.ts");
// @ts-ignore TS5097
const { indexBody } = await import("./opensearch/mappings.ts");
// @ts-ignore TS5097
const { contactDoc, makerDoc, workDoc } = await import("./opensearch/documents.ts");
// @ts-ignore TS5097
const search = await import("./opensearch/search.ts");
// @ts-ignore TS5097
const { paletteSearch } = await import("./palette-search.ts");

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const prefix = testPrefix("pal");
const cfg = testSearchConfig(process.env.OPENSEARCH_TEST_URL || "http://127.0.0.1:1", prefix);
const db = new FakeDb();

// FakeDb has or() with ilike parts but no ilike(): the record tables' single-column search.
const query = Object.getPrototypeOf(db.from("makers"));
if (!query.ilike) {
  query.ilike = function (this: { or(expr: string): unknown }, column: string, pattern: string) {
    return this.or(`${column}.ilike.${pattern}`);
  };
}

/** vw_pieces_list as the view reads: the live works with their maker's name. */
function refreshView() {
  const makers = new Map(db.tables.makers.map((m: Row) => [m.id, m]));
  db.tables.vw_pieces_list = db
    .rowsOf("vw_pieces_all")
    .filter((p: Row) => !p.deleted_at)
    .map((p: Row) => ({ ...p, maker_name: (makers.get(p.maker_id) as Row | undefined)?.display_name ?? null }));
}

/** Every OpenSearch request, counted on the way through to the test node. */
let engineRequests = 0;
const realFetch = globalThis.fetch;

before(async () => {
  if (skip) return;
  await assertNodeCanCreate(prefix);
  // @ts-ignore TS5097
  const load = await import("./opensearch/load.ts");
  for (const kind of SEARCH_KINDS) {
    const r = await os("PUT", `/${cfg.indices[kind]}`, indexBody(kind, INDEX_VERSION[kind]));
    assert.equal(r.status, 200, `create ${kind}: ${JSON.stringify(r.json)}`);
  }
  const docs: Record<string, Row[]> = {
    works: [...(await load.loadWorkSources(db, "all")).values()].map(workDoc).filter(Boolean),
    makers: [...(await load.loadMakerRows(db, "all")).values()].map(makerDoc).filter(Boolean),
    contacts: [...(await load.loadContactSources(db, "all")).values()].map(contactDoc).filter(Boolean),
  };
  for (const kind of SEARCH_KINDS) {
    const res = await bulk(cfg, kind, docs[kind]!.map((d) => ({ op: "index", id: d.id, doc: d })), { version: 1, refresh: true });
    assert.equal(res.ok, docs[kind]!.length);
  }
  refreshView();
  // One row in each record table (FakeDb takes a table's columns from its rows).
  db.tables.offers = [{ id: "of-1", title: "Yokota for the spring fair", kind: "fair_preview", updated_at: "2026-11-01" }];
  db.tables.piece_documents = [{ id: "do-1", title: "Lacquer certificate", doc_type: "certificate", reference: null, created_at: "2026-11-01" }];
  db.tables.shipments = [{ id: "sh-1", kind: "export", reference: "EXP-YOKOTA", shipment_date: "2026-10-01", updated_at: "2026-10-01" }];
  db.tables.piece_lists = [{ id: "pl-1", name: "Spring", updated_at: "2026-10-01" }];
  db.tables.crm_lists = [{ id: "cl-1", name: "Lacquer collectors", updated_at: "2026-10-01" }];
  db.tables.crm_campaigns = [{ id: "cc-1", name: "Spring", subject: "Yokota Yōsai", updated_at: "2026-10-01" }];
  search.setSearchConfigForTests(cfg);
  // The palette gives the engine 600 ms: a first search on fresh indices can take most of it.
  await paletteSearch(db as never, "warm up", ["staff"]);
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    engineRequests++;
    return realFetch(input, init);
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  search.setSearchConfigForTests(undefined);
  if (!skip) await dropIndices(prefix);
});

const run = async (q: string, roles: string[]) => {
  resetCircuit();
  engineRequests = 0;
  return paletteSearch(db as never, q, roles);
};

test("staff: a match only the index knows (provenance) is found and labelled; the accountant gets Postgres's answer only", { skip }, async () => {
  const staff = await run("acquired artist", ["staff"]);
  assert.deepEqual(staff.failed, []);
  assert.ok(staff.pieces.length > 0 && staff.pieces.length <= 6);
  assert.ok(staff.pieces.some((p) => p.matched === "provenance"), JSON.stringify(staff.pieces.map((p) => p.matched)));
  assert.ok(engineRequests > 0);
  const accountant = await run("acquired artist", ["accountant"]);
  assert.equal(engineRequests, 0, "the engine is never asked for the accountant");
  assert.deepEqual(accountant.contacts, []);
  assert.ok(accountant.pieces.every((p) => p.matched === null));
  assert.ok(accountant.pieces.length <= staff.pieces.length);
});

test("a typo: similar works and makers for staff, labelled as such", { skip }, async () => {
  const out = await run("Yosia", ["staff"]);
  assert.ok(out.pieces.length > 0);
  assert.equal(out.similar.pieces, true);
  assert.ok(out.makers.some((m) => m.name === "Yokota Yōsai"));
  assert.equal(out.similar.makers, true);
});

test("contacts: the phone is in the index only; the accountant gets no contacts and no engine request", { skip }, async () => {
  const bewick = db.tables.crm_contacts.find((c: Row) => c.last_name === "Bewick" && c.first_name === "Lucy").id;
  const staff = await run("7946 0018", ["staff"]);
  assert.deepEqual(
    staff.contacts.map((c) => c.id),
    [bewick],
  );
  assert.equal(staff.contacts[0]!.name, "Lucy Bewick");
  const accountant = await run("7946 0018", ["accountant"]);
  assert.deepEqual(accountant.contacts, []);
  assert.equal(engineRequests, 0);
});

test("records: the tables staff may read, by ILIKE through the user's client", { skip }, async () => {
  const staff = await run("yokota", ["staff"]);
  assert.deepEqual(
    staff.records.map((r) => r.type).sort(),
    ["campaign", "offer", "shipment"],
  );
  const accountant = await run("yokota", ["accountant"]);
  assert.deepEqual(
    accountant.records.map((r) => r.type),
    ["shipment"],
  );
});
