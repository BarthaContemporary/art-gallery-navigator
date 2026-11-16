// node --test apps/studio/src/lib/list-add.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them (test files are not type-checked by the app).
// @ts-ignore TS5097
import "./test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "./test-support/fake-supabase.ts";

// @ts-ignore TS5097
const { addPiecesToList, flagsToClear } = await import("./list-add.ts");

const view: Row[] = [
  { id: "j1", stock_number: "2026-0001", ledger: "jvb" },
  { id: "j2", stock_number: "2026-0002", ledger: "jvb" },
  { id: "j3", stock_number: "2026-0003", ledger: "jvb" },
  { id: "x1", stock_number: "X-0001", ledger: "external" },
];
const lists: Row[] = [
  { id: "static", name: "Fair 2026", is_dynamic: false },
  { id: "live", name: "Works at auction", is_dynamic: true },
];

const writes = (calls: { op: string }[]) => calls.filter((c) => c.op !== "select");

test("a live list is refused before anything is written", async () => {
  const { client, calls } = fakeSupabase({ tables: { vw_pieces_list: view, piece_lists: lists, piece_list_items: [] } });
  const r = await addPiecesToList(client, "u1", { listId: "live", pieceIds: ["j1", "j2"] });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 400);
  assert.match(r.ok === false ? r.error : "", /live list/);
  assert.deepEqual(writes(calls), []);
});

test("a list that no longer exists is a 404, not a foreign-key 500", async () => {
  const { client, calls } = fakeSupabase({ tables: { vw_pieces_list: view, piece_lists: lists, piece_list_items: [] } });
  const r = await addPiecesToList(client, "u1", { listId: "gone", pieceIds: ["j1"] });
  assert.equal(r.ok === false && r.status, 404);
  assert.deepEqual(writes(calls), []);
});

test("no new list is created when nothing can be filed", async () => {
  const { client, tables } = fakeSupabase({ tables: { vw_pieces_list: view, piece_lists: lists, piece_list_items: [] } });
  for (let i = 0; i < 2; i++) {
    const r = await addPiecesToList(client, "u1", { name: "Not ours", pieceIds: ["x1"] });
    assert.equal(r.ok === false && r.status, 400);
  }
  assert.equal(tables.piece_lists?.length, 2, "no empty 'Not ours' list left behind");
});

test("a failed read of the works is a 500 with a message, and leaves no list", async () => {
  const { client, tables } = fakeSupabase({
    tables: { vw_pieces_list: view, piece_lists: lists, piece_list_items: [] },
    fail: (req) => (req.table === "vw_pieces_list" ? { message: "view timed out" } : null),
  });
  const r = await addPiecesToList(client, "u1", { name: "New", pieceIds: ["j1"] });
  assert.equal(r.ok === false && r.status, 500);
  assert.match(r.ok === false ? r.error : "", /timed out/);
  assert.equal(tables.piece_lists?.length, 2);
});

test("a new list is removed again when filing into it fails; a given list is left alone", async () => {
  const fail = (req: { table: string | null; op: string }) =>
    req.table === "piece_list_items" && req.op === "upsert" ? { message: "insert refused" } : null;
  const created = fakeSupabase({ tables: { vw_pieces_list: view, piece_lists: lists, piece_list_items: [] }, fail });
  const r = await addPiecesToList(created.client, "u1", { name: "New", pieceIds: ["j1"] });
  assert.equal(r.ok === false && r.status, 500);
  assert.deepEqual(created.tables.piece_lists?.map((l) => l.id), ["static", "live"]);

  const given = fakeSupabase({ tables: { vw_pieces_list: view, piece_lists: lists, piece_list_items: [] }, fail });
  await addPiecesToList(given.client, "u1", { listId: "static", pieceIds: ["j1"] });
  assert.deepEqual(given.tables.piece_lists?.map((l) => l.id), ["static", "live"]);
});

test("added counts only new rows; filed and left-out ids are reported", async () => {
  const { client, tables } = fakeSupabase({
    tables: {
      vw_pieces_list: view,
      piece_lists: lists,
      piece_list_items: [{ list_id: "static", piece_id: "j1", sort_order: 0, excluded: false }],
    },
  });
  // j1 is already in the list, x1 is not JvdB stock, gone1 no longer exists.
  const r = await addPiecesToList(client, "u1", { listId: "static", pieceIds: ["j1", "j2", "x1", "gone1", "j2"] });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.added, 1);
  assert.equal(r.already, 1);
  assert.equal(r.skipped, 2);
  assert.deepEqual(r.filedIds, ["j1", "j2"]);
  assert.deepEqual(r.leftOutIds, ["x1"]);
  // j1 keeps its place; j2 goes after the end (a gap where j1 would have
  // gone is harmless: only the order matters).
  assert.deepEqual(
    tables.piece_list_items?.map((i) => [i.piece_id, i.sort_order]),
    [
      ["j1", 0],
      ["j2", 2],
    ],
  );
});

test("filing the flags clears all but the works left out", () => {
  assert.deepEqual(flagsToClear(["j1", "x1", "gone1", "j2"], ["x1"]), ["j1", "gone1", "j2"]);
  assert.deepEqual(flagsToClear(["j1"], []), ["j1"]);
});
