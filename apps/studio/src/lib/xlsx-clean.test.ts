// node --test apps/studio/src/lib/xlsx-clean.test.ts
// (also worth running under TZ=Europe/London: the result must not change)
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellValue } from "./xlsx-clean.ts";

test("a date column becomes a real date at UTC midnight, on any host clock", () => {
  // A summer date: under UK time a local midnight is 23:00 UTC the day before,
  // which the dd/mm/yyyy cell showed as 14/07/2026.
  const summer = cellValue("sold_date", "2026-07-15");
  assert.ok(summer instanceof Date);
  assert.equal(summer.toISOString(), "2026-07-15T00:00:00.000Z");
  const winter = cellValue("purchase_date", "2026-01-03");
  assert.ok(winter instanceof Date);
  assert.equal(winter.toISOString(), "2026-01-03T00:00:00.000Z");
});

test("other values keep their type", () => {
  assert.equal(cellValue("sold_date", null), "");
  assert.equal(cellValue("sold_date", "15/07/2026"), "15/07/2026");
  assert.equal(cellValue("title", "2026-07-15"), "2026-07-15");
  assert.equal(cellValue("web_visible", true), "Yes");
  assert.equal(cellValue("sold_price_gbp", 1200), 1200);
});
