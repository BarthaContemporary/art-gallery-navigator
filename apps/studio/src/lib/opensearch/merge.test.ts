// node --test apps/studio/src/lib/opensearch/merge.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { inOrder, mergeIds, mergeWorkIds, stockMatch } from "./merge.ts";

const pg = [
  { id: "exact", stock_number: "2026-0338", legacy_stock_number: null },
  { id: "partial", stock_number: "2025-0338-A", legacy_stock_number: null },
  { id: "legacy", stock_number: "2024-0012", legacy_stock_number: "JVB 0338" },
  { id: "title", stock_number: "2023-0001", legacy_stock_number: null },
];

test("with no OpenSearch answer the Postgres order stands, untouched", () => {
  assert.deepEqual(mergeWorkIds("0338", pg, null), ["exact", "partial", "legacy", "title"]);
  assert.deepEqual(mergeIds(["a", "b"], null), ["a", "b"]);
});

test("stock-number matches lead, exact before partial, whatever OpenSearch ranked first", () => {
  assert.deepEqual(mergeWorkIds("2026-0338", pg, ["os1", "title", "exact"]), ["exact", "os1", "title", "partial", "legacy"]);
  // "0338" is nobody's whole number: every work carrying it leads, in the Postgres order.
  assert.deepEqual(mergeWorkIds("0338", pg, ["os1"]), ["exact", "partial", "legacy", "os1", "title"]);
});

test("a work saved a moment ago, which only Postgres can see, is still found", () => {
  // OpenSearch answered, but has not been told about the new record yet.
  const merged = mergeWorkIds("2026-0412", [{ id: "new", stock_number: "2026-0412" }], []);
  assert.deepEqual(merged, ["new"]);
  // And by its title, typed seconds ago: Postgres-only hits are kept after OpenSearch's.
  assert.deepEqual(mergeWorkIds("tea bowl", [{ id: "new", stock_number: "2026-0412" }], ["old1", "old2"]), ["old1", "old2", "new"]);
});

test("nothing Postgres finds is lost and nothing appears twice", () => {
  const merged = mergeWorkIds("bronze", pg, ["title", "os1", "title", "exact"]);
  assert.equal(new Set(merged).size, merged.length);
  for (const r of pg) assert.ok(merged.includes(r.id), r.id);
  assert.deepEqual(merged.slice(0, 3), ["title", "os1", "exact"]);
});

test("stock numbers compare without case or outer spaces; an empty query matches nothing", () => {
  assert.equal(stockMatch(" x-0007 ", { id: "a", stock_number: "X-0007" }), 2);
  assert.equal(stockMatch("0007", { id: "a", stock_number: "X-0007" }), 1);
  assert.equal(stockMatch("", { id: "a", stock_number: "X-0007" }), 0);
  assert.equal(stockMatch("0007", { id: "a", stock_number: null, legacy_stock_number: undefined }), 0);
});

test("rows come back in merged order and ids the user cannot load are dropped", () => {
  const rows = [{ id: "b", n: 2 }, { id: "a", n: 1 }];
  assert.deepEqual(inOrder(["a", "trashed-since", "b"], rows), [{ id: "a", n: 1 }, { id: "b", n: 2 }]);
});

test("contacts: OpenSearch first, the rest of Postgres after", () => {
  assert.deepEqual(mergeIds(["p1", "both", "p2"], ["o1", "both"]), ["o1", "both", "p1", "p2"]);
});
