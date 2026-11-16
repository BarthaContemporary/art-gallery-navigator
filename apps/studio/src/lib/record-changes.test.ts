// node --test apps/studio/src/lib/record-changes.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHANGED_FIELD,
  DIMENSION_KEYS,
  FINANCIAL_KEYS,
  PIECE_COLUMN_KEYS,
  changedKeys,
  onlyChanged,
  readChangedKeys,
  touches,
} from "./record-changes.ts";

const form = (entries: [string, string][]) => {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
};
const snap = (entries: [string, string][]) => JSON.stringify(entries);

test("no _changed field means every field is written", () => {
  assert.equal(readChangedKeys(form([["title", "Vase"]])), null);
  assert.equal(touches(null, ["status"]), true);
  const row = { title: "Vase", status: "in_stock", updated_by: "u1" };
  assert.deepEqual(onlyChanged(row, null), row);
});

test("an unreadable _changed field also means every field is written", () => {
  assert.equal(readChangedKeys(form([[CHANGED_FIELD, "not json"]])), null);
  assert.equal(readChangedKeys(form([[CHANGED_FIELD, '{"title":true}']])), null);
  const fd = new FormData();
  fd.append(CHANGED_FIELD, new Blob(["[]"]), "x.json");
  assert.equal(readChangedKeys(fd), null);
});

test("_changed lists the names; anything not a string is dropped", () => {
  const got = readChangedKeys(form([[CHANGED_FIELD, '["title", 3, "status"]']]));
  assert.deepEqual([...(got ?? [])].sort(), ["status", "title"]);
  assert.deepEqual([...(readChangedKeys(form([[CHANGED_FIELD, "[]"]])) ?? ["x"])], []);
});

test("a stale tab's typo fix writes the title only, not its old status, location or website switch", () => {
  const row = {
    title: "Vase, corrected",
    status: "in_stock",
    location_id: "old-shelf",
    web_visible: true,
    updated_by: "u1",
  };
  assert.deepEqual(onlyChanged(row, new Set(["title"])), { title: "Vase, corrected", updated_by: "u1" });
});

test("a posted name that is not a column the editor writes writes nothing", () => {
  const row = { title: "Vase", updated_by: "u1" };
  assert.deepEqual(onlyChanged(row, new Set(["deleted_at", "__proto__", "constructor"])), { updated_by: "u1" });
  // The map is the route's own: a posted name never becomes a column.
  const out = onlyChanged(row, new Set(["deleted_at"]));
  assert.equal(Object.hasOwn(out, "deleted_at"), false);
});

test("the dimensions are written as one group", () => {
  const row = {
    height_cm: 10,
    width_cm: 20,
    framed: false,
    unframed_height_cm: null,
    unframed_width_cm: null,
    title: "Scroll",
    updated_by: "u1",
  };
  // Unticking Framed removes the box and the unframed fields from the form:
  // the stored unframed sizes are cleared with the switch.
  const out = onlyChanged(row, new Set(["framed", "unframed_height_cm"]));
  assert.deepEqual(out, {
    height_cm: 10,
    width_cm: 20,
    framed: false,
    unframed_height_cm: null,
    unframed_width_cm: null,
    updated_by: "u1",
  });
  for (const k of DIMENSION_KEYS) assert.deepEqual(PIECE_COLUMN_KEYS[k], DIMENSION_KEYS);
});

test("the financial block is written whole when any of it changed", () => {
  assert.equal(touches(new Set(["marked_price_gbp"]), FINANCIAL_KEYS), true);
  assert.equal(touches(new Set(["buyer_contact_id"]), FINANCIAL_KEYS), true);
  assert.equal(touches(new Set(["title", "status"]), FINANCIAL_KEYS), false);
  // No financial field is a stock-table column.
  for (const k of FINANCIAL_KEYS) assert.equal(Object.hasOwn(PIECE_COLUMN_KEYS, k), false);
});

test("changedKeys compares two snapshots over the names in either", () => {
  const before = snap([
    ["title", "Vase"],
    ["status", "in_stock"],
    ["framed", "on"],
    ["unframed_height_cm", "12"],
    ["web_visible", "on"],
  ]);
  // Framed unticked: the box and the unframed field leave the form.
  const after = snap([
    ["title", "Vase"],
    ["status", "in_stock"],
    ["web_visible", "on"],
    ["needs_completion", ""],
  ]);
  assert.deepEqual(changedKeys(before, after), ["framed", "needs_completion", "unframed_height_cm"]);
  assert.deepEqual(changedKeys(after, after), []);
});

test("changedKeys compares a repeated name as its whole list of values", () => {
  const a = snap([
    ["tag", "a"],
    ["tag", "b"],
  ]);
  const b = snap([
    ["tag", "b"],
    ["tag", "a"],
  ]);
  assert.deepEqual(changedKeys(a, b), ["tag"]);
  assert.deepEqual(changedKeys(a, snap([["tag", "a"]])), ["tag"]);
});

test("changedKeys gives null (write everything) without a readable snapshot", () => {
  assert.equal(changedKeys(null, snap([["title", "x"]])), null);
  assert.equal(changedKeys("nope", snap([["title", "x"]])), null);
  assert.equal(changedKeys(snap([["title", "x"]]), '[{"title":"x"}]'), null);
});

test("changedKeys never lists _changed itself", () => {
  const a = snap([["title", "x"]]);
  const b = snap([
    ["title", "y"],
    [CHANGED_FIELD, '["title"]'],
  ]);
  assert.deepEqual(changedKeys(a, b), ["title"]);
});

test("every field of the record editor that writes a stock-table column is mapped", () => {
  const editorColumns = [
    "title", "year", "maker_id", "category_id", "location_id", "status", "medium", "period",
    "origin_region", "description", "condition_report", "signature_inscription", "box_type",
    "box_notes", "comments", "source_note", "publications", "exhibitions", "purchased_from",
    "sold_to", "web_visible", "presentation", "needs_completion", ...DIMENSION_KEYS,
  ];
  for (const c of editorColumns) assert.ok(PIECE_COLUMN_KEYS[c]?.includes(c), c);
  assert.equal(Object.hasOwn(PIECE_COLUMN_KEYS, "updated_by"), false);
});
