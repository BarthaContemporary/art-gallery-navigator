// Against a local OpenSearch (security off), with this run's own index prefix:
//   OPENSEARCH_TEST_URL=http://127.0.0.1:9209 node --test apps/studio/src/lib/picker-search.int.test.ts
// Without the variable every test here is skipped, so `pnpm test:unit` stays self-contained.
//
// The add-works and add-contacts boxes end to end: the works and contacts
// indices built from the fixtures (scripts/studio-preview/fixtures/data)
// with mappings.ts and documents.ts, Postgres played by the fixture FakeDb,
// rows read from its vw_pieces_list and crm_contacts.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- plain JS test support
import { FakeDb, allowStudioImports, assertNodeCanCreate, dropIndices, os, skipWithoutNode as skip, testPrefix } from "./opensearch/test-support.mjs";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { INDEX_VERSION, testSearchConfig } from "./opensearch/config.ts";
// @ts-ignore TS5097
import { bulk, resetCircuit } from "./opensearch/client.ts";
// @ts-ignore TS5097
import { indexBody } from "./opensearch/mappings.ts";
// @ts-ignore TS5097
import { contactDoc, workDoc } from "./opensearch/documents.ts";

allowStudioImports();
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type PickerModule = typeof import("./picker-search");
type SearchModule = typeof import("./opensearch/search");

const prefix = testPrefix("picker");
const cfg = testSearchConfig(process.env.OPENSEARCH_TEST_URL || "http://127.0.0.1:1", prefix);

/** The fixture FakeDb with vw_pieces_list: both registers, the trash left out, the maker's name joined. */
class PickerDb extends FakeDb {
  rowsOf(table: string): Row[] {
    if (table !== "vw_pieces_list") return super.rowsOf(table);
    const makers = new Map(this.tables.makers.map((m: Row) => [m.id, m]));
    return [...this.tables.pieces, ...this.tables.external_pieces]
      .filter((p: Row) => !p.deleted_at)
      .map((p: Row) => ({ ...p, maker_name: (makers.get(p.maker_id) as Row | undefined)?.display_name ?? null }));
  }
  columnsOf(table: string): Set<string> {
    if (table !== "vw_pieces_list") return super.columnsOf(table);
    return new Set([...Object.keys(this.tables.pieces[0] ?? {}), "maker_name"]);
  }
}
const db = new PickerDb();

let picker: PickerModule;
let search: SearchModule;
const YOSAI = "Yokota Yōsai";
let yosaiLive: string[] = [];
let yosaiTrashed: string[] = [];

before(async () => {
  if (skip) return;
  // @ts-ignore TS5097
  picker = (await import("./picker-search.ts")) as PickerModule;
  // @ts-ignore TS5097
  search = (await import("./opensearch/search.ts")) as SearchModule;
  search.setSearchConfigForTests(cfg);
  await assertNodeCanCreate(prefix);
  // @ts-ignore TS5097
  const load = await import("./opensearch/load.ts");
  for (const kind of ["works", "contacts"] as const) {
    const r = await os("PUT", `/${cfg.indices[kind]}`, indexBody(kind, INDEX_VERSION[kind]));
    assert.equal(r.status, 200, `create ${kind}: ${JSON.stringify(r.json)}`);
  }
  const works = [...(await load.loadWorkSources(db, "all")).values()].map(workDoc).filter(Boolean) as Row[];
  const contacts = [...(await load.loadContactSources(db, "all")).values()].map(contactDoc).filter(Boolean) as Row[];
  for (const [kind, docs] of [["works", works], ["contacts", contacts]] as const) {
    const res = await bulk(cfg, kind, docs.map((d) => ({ op: "index", id: d.id, doc: d })), { version: 1, refresh: true });
    assert.equal(res.ok, docs.length, `${kind} documents indexed`);
  }
  const maker = db.tables.makers.find((m: Row) => m.display_name === YOSAI);
  const all = [...db.tables.pieces, ...db.tables.external_pieces].filter((p: Row) => p.maker_id === maker.id);
  yosaiLive = all.filter((p: Row) => !p.deleted_at).map((p: Row) => p.id);
  yosaiTrashed = all.filter((p: Row) => p.deleted_at).map((p: Row) => p.id);
  assert.ok(yosaiLive.length >= 2 && yosaiTrashed.length >= 1, "fixtures: live and trashed works by Yōsai");
});
after(async () => {
  if (skip) return;
  search.setSearchConfigForTests(undefined);
  await dropIndices(prefix);
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

test("a typo in the add-works box: no exact match, the maker's works offered as similar, the trash never", { skip }, async () => {
  resetCircuit();
  const out = await picker.pickWorks(db as never, "Yosia", { roles: ["staff"] });
  assert.equal(out.error, null);
  assert.equal(out.similar, true);
  for (const id of yosaiLive) assert.ok(ids(out.rows).includes(id), `${id} offered`);
  for (const id of yosaiTrashed) assert.ok(!ids(out.rows).includes(id), `${id} is in the trash`);
  // Every string shown comes from the rows the user's client loaded.
  for (const r of out.rows) assert.ok(r.stock_number && "maker_name" in r);
});

test("the same typo for the accountant: Postgres only, so no match, as today", { skip }, async () => {
  resetCircuit();
  const out = await picker.pickWorks(db as never, "Yosia", { roles: ["accountant"] });
  assert.deepEqual(out, { rows: [], similar: false, error: null });
});

test("similar works already on the record are not offered, and nothing is labelled", { skip }, async () => {
  resetCircuit();
  const out = await picker.pickWorks(db as never, "Yosia", { roles: ["admin"], exclude: new Set(yosaiLive) });
  assert.ok(!ids(out.rows).some((id) => yosaiLive.includes(id)));
  if (out.rows.length === 0) assert.equal(out.similar, false);
});

test("an exact search: not similar, the maker's live works, best first by stock number when typed", { skip }, async () => {
  resetCircuit();
  const byName = await picker.pickWorks(db as never, "Yokota", { roles: ["staff"] });
  assert.equal(byName.similar, false);
  for (const id of yosaiLive) assert.ok(ids(byName.rows).includes(id));
  for (const id of yosaiTrashed) assert.ok(!ids(byName.rows).includes(id));
  const first = db.rowsOf("vw_pieces_list").find((p: Row) => p.id === yosaiLive[0]);
  const byNumber = await picker.pickWorks(db as never, first.stock_number, { roles: ["staff"] });
  assert.equal(byNumber.rows[0]?.id, first.id);
});

test("a typo in the recipients box finds the contacts; an erased contact is never offered", { skip }, async () => {
  resetCircuit();
  const bewicks = db.tables.crm_contacts.filter((c: Row) => c.last_name === "Bewick").map((c: Row) => c.id);
  const out = await picker.pickContacts(db as never, "Bewik", { roles: ["staff"] });
  assert.equal(out.error, null);
  for (const id of bewicks) assert.ok(ids(out.rows).includes(id), `${id} offered`);
  const erased = await picker.pickContacts(db as never, "Erased", { roles: ["staff"] });
  assert.deepEqual(ids(erased.rows), []);
});
