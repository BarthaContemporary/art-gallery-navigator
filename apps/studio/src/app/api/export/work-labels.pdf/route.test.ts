// node --test apps/studio/src/app/api/export/work-labels.pdf/route.test.ts
//
// Work labels for an inventory list: a read that fails answers with its
// reason as text (the labels button shows it), never a bare 500. The route
// and the list resolver run as they are, against the in-memory PostgREST
// stand-in; the PDF renderer, the label layout, the drive copy and the
// cookie client are stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore TS5097
import "../../../../lib/test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "../../../../lib/test-support/fake-supabase.ts";
// @ts-ignore TS5097
import { fakeModules } from "../../../../lib/test-support/module-fakes.ts";

const state = globalThis as unknown as { __labels: { db: unknown; rendered: unknown[] } };
fakeModules({
  "@/lib/supabase": `export const getSupabase = async () => globalThis.__labels.db;`,
  "@/lib/shared-drive": `export const exportResponse = (_req, bytes, type) => new Response(bytes, { status: 200, headers: { "content-type": type } });`,
  "@react-pdf/renderer": `export const renderToBuffer = async (doc) => { globalThis.__labels.rendered.push(doc); return new Uint8Array([37, 80, 68, 70]); };`,
  "@jvb/documents": `export const WorkLabels = (props) => props;`,
  "@jvb/db": `
    export const DIMENSION_COLUMNS = "height_cm, width_cm";
    export const formatDimensionsFullCm = () => null;
    export const titleWithYear = (title, year) => [title, year].filter(Boolean).join(", ");
  `,
});
// @ts-ignore TS5097
const { GET } = await import("./route.ts");

const LIST = { id: "L1", is_dynamic: false, filter_rules: null };
const work = (n: number, extra: Row = {}): Row => ({
  id: `w${n}`,
  stock_number: `2026-000${n}`,
  title: `Work ${n}`,
  year: null,
  maker_name: null,
  deleted_at: null,
  web_visible: true,
  ...extra,
});

function signedIn(tables: Record<string, Row[]>, fail?: (req: { table: string | null; op: string }) => { message: string } | null) {
  const fake = fakeSupabase({ tables, fail });
  const client = { ...fake.client, auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } };
  state.__labels = { db: client, rendered: [] };
  return fake;
}

const get = async (list = "L1") => {
  const res: Response = await GET(new Request(`http://studio.test/api/export/work-labels.pdf?list=${list}&template=L7160`));
  return { status: res.status, text: res.headers.get("content-type") === "application/pdf" ? "" : await res.text() };
};

const tables = () => ({
  piece_lists: [LIST],
  piece_list_items: [
    { list_id: "L1", piece_id: "w1", sort_order: 0, excluded: false },
    { list_id: "L1", piece_id: "w2", sort_order: 1, excluded: false },
  ],
  vw_pieces_list: [work(1), work(2)],
  vw_pieces_all: [work(1), work(2)],
});

test("a list whose works cannot be read answers 500 with the reason, as text", async () => {
  for (const table of ["piece_list_items", "vw_pieces_list", "vw_pieces_all"]) {
    signedIn(tables(), (req) => (req.table === table ? { message: `${table} timed out` } : null));
    const { status, text } = await get();
    assert.equal(status, 500, table);
    assert.match(text, /^Could not make the labels\. /, table);
    assert.match(text, new RegExp(`${table} timed out`), table);
    assert.equal(state.__labels.rendered.length, 0, "no sheet with works missing");
  }
});

test("a list that cannot be read says so; one that does not exist is a 404", async () => {
  signedIn(tables(), (req) => (req.table === "piece_lists" ? { message: "permission denied" } : null));
  assert.deepEqual(await get(), { status: 500, text: "Could not read the list: permission denied" });
  signedIn(tables());
  assert.equal((await get("nope")).status, 404);
});

test("the labels are made for the list's works, in its order", async () => {
  signedIn(tables());
  const { status } = await get();
  assert.equal(status, 200);
  const doc = state.__labels.rendered[0] as { works: { stockNumber: string }[]; template: string };
  assert.deepEqual(doc.works.map((w) => w.stockNumber), ["2026-0001", "2026-0002"]);
  assert.equal(doc.template, "L7160");
});

test("signed out: 401", async () => {
  const fake = fakeSupabase({ tables: tables() });
  state.__labels = { db: { ...fake.client, auth: { getUser: async () => ({ data: { user: null } }) } }, rendered: [] };
  assert.equal((await get()).status, 401);
  assert.equal(fake.calls.length, 0);
});
