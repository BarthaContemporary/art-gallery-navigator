// The inventory's search against a local OpenSearch (security off), with this run's own index prefix:
//   OPENSEARCH_TEST_URL=http://127.0.0.1:9209 node --test apps/studio/src/lib/inventory-query.int.test.ts
// Without the variable every test here is skipped, so `pnpm test:unit` stays self-contained.
//
// A works index from mappings.ts, filled from the fixtures (scripts/studio-preview/fixtures/data)
// as the drain would fill it; Postgres is test-support's FakeDb, with vw_pieces_list
// (the live works, both registers) beside it. The page's own call: resolveInventory.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extensions; the studio's tsconfig does not allow them.
// @ts-ignore TS5097
import "./test-support/alias.ts";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports, assertNodeCanCreate, dropIndices, os, skipWithoutNode as skip, testPrefix } from "./opensearch/test-support.mjs";

allowStudioImports();
// @ts-ignore TS5097
const { INDEX_VERSION, testSearchConfig } = await import("./opensearch/config.ts");
// @ts-ignore TS5097
const { bulk, resetCircuit } = await import("./opensearch/client.ts");
// @ts-ignore TS5097
const { indexBody } = await import("./opensearch/mappings.ts");
// @ts-ignore TS5097
const { workDoc } = await import("./opensearch/documents.ts");
// @ts-ignore TS5097
const search = await import("./opensearch/search.ts");
// @ts-ignore TS5097
const { resolveInventory } = await import("./inventory-query.ts");

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const prefix = testPrefix("inv");
const cfg = testSearchConfig(process.env.OPENSEARCH_TEST_URL || "http://127.0.0.1:1", prefix);
const db = new FakeDb();
const YOSAI = "3a6e0000-0002-4000-8000-3a6e00000000";

/** vw_pieces_list as the view reads: the works not in the trash, both registers. */
function refreshView() {
  db.tables.vw_pieces_list = db.rowsOf("vw_pieces_all").filter((p: Row) => !p.deleted_at).map((p: Row) => ({ ...p }));
}
const stockOf = (id: string) => db.rowsOf("vw_pieces_all").find((p: Row) => p.id === id)?.stock_number as string;
const run = async (q: string, roles: string[], more: Record<string, string> = {}) => {
  resetCircuit();
  return resolveInventory(db as never, new URLSearchParams({ q, ...more }), null, { roles });
};

before(async () => {
  if (skip) return;
  await assertNodeCanCreate(prefix);
  // @ts-ignore TS5097
  const load = await import("./opensearch/load.ts");
  const r = await os("PUT", `/${cfg.indices.works}`, indexBody("works", INDEX_VERSION.works));
  assert.equal(r.status, 200, `create works: ${JSON.stringify(r.json)}`);
  const docs = [...(await load.loadWorkSources(db, "all")).values()].map(workDoc).filter(Boolean) as Row[];
  const res = await bulk(cfg, "works", docs.map((d) => ({ op: "index", id: d.id, doc: d })), { version: 1, refresh: true });
  assert.equal(res.ok, docs.length);
  refreshView();
  search.setSearchConfigForTests(cfg);
});
after(async () => {
  search.setSearchConfigForTests(undefined);
  if (!skip) await dropIndices(prefix);
});

test("a typo finds the maker's works as similar matches, JvdB stock only by default", { skip }, async () => {
  const got = await run("Yosia", ["staff"]);
  assert.equal(got?.similar, true);
  // The JvdB Yōsai works, first; the external one is in the trash in the fixtures.
  assert.deepEqual(new Set(got?.ids.slice(0, 3).map(stockOf)), new Set(["2019-0002", "2024-0005", "2026-0012"]));
  assert.ok(got!.ids.every((id) => db.tables.vw_pieces_list.find((p: Row) => p.id === id)?.ledger === "jvb"));
  // The accountant searches Postgres alone: no typo tolerance, as before.
  assert.deepEqual(await run("Yosia", ["accountant"]), { ids: [], similar: false });
});

test("a stock number finds that work first, and the strict pass is never 'similar'", { skip }, async () => {
  const got = await run("2024-0005", ["admin"]);
  assert.equal(stockOf(got!.ids[0]!), "2024-0005");
  assert.equal(got?.similar, false);
});

test("a work trashed since it was indexed is dropped by the view, though the index still has it", { skip }, async () => {
  const first = await run("Yōsai", ["staff"]);
  const gone = first!.ids.find((id) => stockOf(id) === "2024-0005")!;
  assert.ok(gone);
  const piece = db.tables.pieces.find((p: Row) => p.id === gone);
  piece.deleted_at = new Date().toISOString();
  refreshView();
  try {
    const then = await run("Yōsai", ["staff"]);
    assert.ok(!then!.ids.includes(gone));
    assert.deepEqual(then!.ids, first!.ids.filter((id) => id !== gone), "the rest keep their order");
    // Both registers: the external Yōsai work (X-2026-0008) is in the
    // trash in the fixtures, so it stays out too.
    const both = await run("Yōsai", ["staff"], { ledger: "all" });
    const yosaiStock = both!.ids.filter((id) => db.rowsOf("vw_pieces_all").find((p: Row) => p.id === id)?.maker_id === YOSAI).map(stockOf);
    assert.deepEqual(new Set(yosaiStock), new Set(["2019-0002", "2026-0012"]));
  } finally {
    piece.deleted_at = null;
    refreshView();
  }
});
