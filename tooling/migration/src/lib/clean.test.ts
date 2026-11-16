// node --test tooling/migration/src/lib/clean.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanRows } from "./clean.ts";
import { COL } from "./columns.ts";

const row = (row_number: number, data: Record<string, unknown>) => ({ row_number, data });

test("cells that do not parse are flagged, not dropped quietly", () => {
  const { rows, issues } = cleanRows([
    row(2, {
      [COL.stockNumber]: "100",
      [COL.purchaseCost]: "1200 approx",
      [COL.markedPrice]: "POA",
      [COL.datePurchased]: "June 2015",
    }),
  ]);
  assert.equal(rows[0]!.purchase_cost, null);
  assert.equal(rows[0]!.marked_price, null);
  assert.equal(rows[0]!.purchase_date, null);
  const kinds = issues.filter((i) => i.row_number === 2).map((i) => `${i.field}:${i.issue}`);
  assert.ok(kinds.includes(`${COL.purchaseCost}:number_parse_failed`));
  assert.ok(kinds.includes(`${COL.markedPrice}:number_parse_failed`));
  assert.ok(kinds.includes(`${COL.datePurchased}:date_parse_failed`));
});

test("a sold price that does not parse still marks the work sold", () => {
  const { rows, issues } = cleanRows([row(3, { [COL.stockNumber]: "101", [COL.soldPrice]: "£3,000 (incl. frame)" })]);
  assert.equal(rows[0]!.proposed_status, "sold");
  assert.equal(rows[0]!.sold_price, null);
  assert.ok(issues.some((i) => i.issue === "number_parse_failed" && i.field === COL.soldPrice));
  // An empty or zero sold price is no sale.
  const { rows: unsold } = cleanRows([row(4, { [COL.stockNumber]: "102", [COL.soldPrice]: "0" })]);
  assert.equal(unsold[0]!.proposed_status, "in_stock");
});

test("a foreign purchase at the stale rate 1 gets no GBP cost", () => {
  const { rows, issues } = cleanRows([
    row(5, { [COL.stockNumber]: "103", [COL.purchaseCost]: 500000, [COL.purchaseFx]: 1, [COL.purchaseCurrency]: "¥" }),
  ]);
  assert.equal(rows[0]!.purchase_cost, 500000);
  assert.equal(rows[0]!.purchase_currency, "JPY");
  assert.equal(rows[0]!.purchase_cost_gbp, null);
  assert.ok(issues.some((i) => i.issue === "fx_suspect_rate_1_for_foreign_currency"));
});
