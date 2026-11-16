// node --test apps/studio/src/lib/inventory-query.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import "./test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "./test-support/fake-supabase.ts";

// @ts-ignore TS5097
const iq = await import("./inventory-query.ts");
const { PIECE_STATUS_ORDER, loadInventoryExportRows, resolveInventoryIds, selectInventoryPage, sortInventoryRows } = iq;

const ids = (rows: Row[]) => rows.map((r) => r.id);

test("status sorts in the enum's order, as SQL sorts it, both ways", () => {
  const rows = ["sold", "in_stock", "written_off", "gifted", "reserved", "consigned_in", "returned", "consigned_out"].map(
    (status, i) => ({ id: `id${i}`, stock_number: `2026-000${i}`, status }),
  );
  const asc = sortInventoryRows([...rows], { column: "status", ascending: true }).map((r) => r.status);
  assert.deepEqual(asc, [...PIECE_STATUS_ORDER]);
  const desc = sortInventoryRows([...rows], { column: "status", ascending: false }).map((r) => r.status);
  assert.deepEqual(desc, [...PIECE_STATUS_ORDER].reverse());
});

test("equal keys fall back to the stock number in the same direction, then the id; nulls stay last", () => {
  const rows: Row[] = [
    { id: "b", stock_number: "2026-0002", maker_name: "Akiyama" },
    { id: "a", stock_number: "2026-0003", maker_name: null },
    { id: "d", stock_number: "2026-0001", maker_name: "akiyama" },
    { id: "c", stock_number: "2026-0002", maker_name: "Akiyama" },
    { id: "e", stock_number: "2026-0004", maker_name: "Zenzo" },
  ];
  assert.deepEqual(ids(sortInventoryRows([...rows], { column: "maker_name", ascending: true })), ["d", "b", "c", "e", "a"]);
  assert.deepEqual(ids(sortInventoryRows([...rows], { column: "maker_name", ascending: false })), ["e", "b", "c", "d", "a"]);
  // Whatever order the rows arrive in (chunks come back unordered).
  assert.deepEqual(
    ids(sortInventoryRows([...rows].reverse(), { column: "maker_name", ascending: true })),
    ["d", "b", "c", "e", "a"],
  );
});

/** A work as vw_pieces_list shows it. */
function work(n: number, over: Row = {}): Row {
  return {
    id: `w${String(n).padStart(4, "0")}`,
    stock_number: `2026-${String(n).padStart(4, "0")}`,
    title: `Work ${n}`,
    status: "in_stock",
    category_id: null,
    location_id: null,
    ledger: "jvb",
    web_visible: true,
    on_temp_export: false,
    needs_completion: false,
    missing_purchase_gbp: false,
    ...over,
  };
}

test("a list view sorted by status matches the plain view's order", async () => {
  const works = [
    work(1, { status: "sold" }),
    work(2, { status: "in_stock" }),
    work(3, { status: "consigned_in" }),
    work(4, { status: "in_stock" }),
    work(5, { status: "gifted" }),
  ];
  const { client, calls } = fakeSupabase({
    tables: {
      vw_pieces_list: works,
      piece_lists: [{ id: "L1", is_dynamic: false, filter_rules: null }],
      piece_list_items: works.map((w, i) => ({ list_id: "L1", piece_id: w.id, sort_order: i, excluded: false })),
    },
  });
  const params = new URLSearchParams({ list: "L1", sort: "status", dir: "asc" });
  const got = await resolveInventoryIds(client, params, { column: "status", ascending: true });
  // Available, Consigned in, Sold, Gifted: the enum's order, not the
  // alphabet's (which put consigned_in and gifted before in_stock). The two
  // Available works by stock number.
  assert.deepEqual(got, ["w0002", "w0004", "w0003", "w0001", "w0005"]);
  const read = calls.find((c) => c.table === "vw_pieces_list" && (c.columns ?? "").includes("status"));
  assert.ok(read && (read.columns ?? "").includes("stock_number"), "the tie-break column is read");
});

test("a search keeps its relevance order and asks only for the columns it filters on", async () => {
  const hits = [work(7), work(2, { ledger: "external" }), work(5), work(9, { status: "sold" })];
  const { client, calls } = fakeSupabase({ rpc: { pieces_search: () => hits } });
  const got = await resolveInventoryIds(client, new URLSearchParams({ q: "vase", status: "!sold" }), null);
  assert.deepEqual(got, ["w0007", "w0005"]);
  const search = calls.find((c) => c.rpc === "pieces_search");
  assert.equal(search?.columns, "id, status, category_id, location_id, ledger");
});

test("a failed list read is an error, not the whole stock", async () => {
  const { client } = fakeSupabase({
    tables: { vw_pieces_list: [work(1)] },
    fail: (req) => (req.table === "piece_lists" ? { message: "timeout" } : null),
  });
  await assert.rejects(resolveInventoryIds(client, new URLSearchParams({ list: "L1" }), null), /timeout/);
});

test("the plain view pages on a total order and survives a page past the end", async () => {
  const works = Array.from({ length: 5 }, (_, i) => work(i + 1, { status: i % 2 ? "sold" : "in_stock" }));
  works.push(work(6, { ledger: "external" }));
  const { client, calls } = fakeSupabase({ tables: { vw_pieces_list: works } });
  const order = { column: "status", ascending: true };

  const first = await selectInventoryPage<Row>(client, new URLSearchParams(), order, 0, 1);
  assert.equal(first.total, 5, "JvdB stock only by default");
  assert.deepEqual(ids(first.rows), ["w0001", "w0003"]);
  const paged = calls.at(-1);
  assert.deepEqual(
    paged?.orders.map((o) => [o.column, o.ascending]),
    [
      ["status", true],
      ["stock_number", true],
      ["id", true],
    ],
  );

  // An old ?page= link past the end: no error, the total alone.
  const past = await selectInventoryPage<Row>(client, new URLSearchParams(), order, 100, 199);
  assert.deepEqual(past, { rows: [], total: 5 });

  // Any other failure is still an error.
  const broken = fakeSupabase({ tables: { vw_pieces_list: works }, fail: () => ({ message: "boom" }) });
  await assert.rejects(selectInventoryPage(broken.client, new URLSearchParams(), order, 0, 1), /boom/);
});

test("an export of the plain view keeps the screen's tie-break", async () => {
  const works = [work(1, { status: "sold" }), work(2), work(3, { status: "sold" }), work(4)];
  const { client } = fakeSupabase({ tables: { vw_pieces_list: works } });
  const rows = await loadInventoryExportRows(client, new URLSearchParams({ sort: "status", dir: "desc" }));
  assert.deepEqual(ids(rows), ["w0003", "w0001", "w0004", "w0002"]);
});
