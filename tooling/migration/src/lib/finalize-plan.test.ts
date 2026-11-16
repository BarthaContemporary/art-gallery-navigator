// node --test tooling/migration/src/lib/finalize-plan.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeRefusal, MAPPING_KINDS, purchaseYearSeries, resolveCode } from "./finalize-plan.ts";

test("finalize refuses a database that already holds an import, unless resuming", () => {
  assert.equal(finalizeRefusal({ linkedRows: 0, importedPieces: 0 }, false), null);
  assert.match(finalizeRefusal({ linkedRows: 1087, importedPieces: 1080 }, false) ?? "", /--resume/);
  // Purged works leave their legacy row unlinked, but other works still
  // carry legacy numbers: still refused.
  assert.notEqual(finalizeRefusal({ linkedRows: 0, importedPieces: 3 }, false), null);
  assert.notEqual(finalizeRefusal({ linkedRows: 5, importedPieces: 0 }, false), null);
  assert.equal(finalizeRefusal({ linkedRows: 1087, importedPieces: 1080 }, true), null);
});

test("purchase-year series continues after the numbers already used", () => {
  const rows = [
    { row_number: 10, purchase_date: "2019-05-01" },
    { row_number: 11, purchase_date: "2019-01-15" },
    { row_number: 12, purchase_date: "2020-03-03" },
    { row_number: 13, purchase_date: null },
  ];
  const fresh = purchaseYearSeries(rows, new Map(), 2026);
  assert.equal(fresh.numbers.get(11), "2019-0001"); // chronological
  assert.equal(fresh.numbers.get(10), "2019-0002");
  assert.equal(fresh.numbers.get(12), "2020-0001");
  assert.equal(fresh.numbers.get(13), "2026-0001");
  assert.deepEqual([...fresh.lastByYear], [[2019, 2], [2020, 1], [2026, 1]]);

  // A resumed run (or works made meanwhile): no number is used twice.
  const resumed = purchaseYearSeries(rows, new Map([[2019, 2], [2026, 40]]), 2026);
  assert.equal(resumed.numbers.get(11), "2019-0003");
  assert.equal(resumed.numbers.get(10), "2019-0004");
  assert.equal(resumed.numbers.get(12), "2020-0001");
  assert.equal(resumed.numbers.get(13), "2026-0041");
});

test("category and location codes resolve only to codes that exist", () => {
  const locations = new Map([
    ["SJ-B2", "loc-1"],
    ["PP", "loc-2"],
    ["AUCTION", "loc-3"],
    ["ST-JAMES", "loc-4"],
  ]);
  assert.deepEqual(resolveCode({ mapped_kind: "storage_location", mapped_value: "SJ-B2" }, "storage_location", locations), {
    id: "loc-1",
    unresolved: null,
  });
  assert.deepEqual(resolveCode({ mapped_kind: "storage_location", mapped_value: "auction" }, "storage_location", locations), {
    id: "loc-3",
    unresolved: null,
  });
  // 'SJ' names no seeded location: reported, not guessed.
  assert.deepEqual(resolveCode({ mapped_kind: "storage_location", mapped_value: "SJ" }, "storage_location", locations), {
    id: null,
    unresolved: "SJ",
  });
  // Another kind on the same column is not a location.
  assert.deepEqual(resolveCode({ mapped_kind: "origin_region", mapped_value: "India" }, "storage_location", locations), {
    id: null,
    unresolved: null,
  });
  assert.deepEqual(resolveCode(null, "category_code", new Map()), { id: null, unresolved: null });
  assert.deepEqual(resolveCode({ mapped_kind: "category_code", mapped_value: "A" }, "category_code", new Map([["JP", "c"]])), {
    id: null,
    unresolved: "A",
  });
});

test("the mapping kinds are the ones gen-mappings proposes", () => {
  assert.deepEqual([...MAPPING_KINDS].sort(), [
    "buyer_note",
    "category_code",
    "origin_region",
    "status",
    "storage_location",
    "unknown",
    "web_published",
  ]);
});
