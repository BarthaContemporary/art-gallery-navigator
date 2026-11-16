// node --test apps/studio/src/lib/consignment.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { consignmentSplit, saleNetProfit, saleVat, sixth } from "./consignment.ts";

/** Postgres round(p / 6, 2) for a whole number of pence, worked exactly. */
function exactSixthPence(p: number): number {
  const q = Math.floor(p / 6);
  return p % 6 >= 3 ? q + 1 : q;
}

test("a sixth is taken in whole pence and rounds half up, as the views do", () => {
  for (let p = 0; p <= 600_000; p++) {
    assert.equal(Math.round(sixth(p / 100) * 100), exactSixthPence(p), `${p}p`);
  }
  // The reported case: sale 3,117.70 less cost 2,818.39 is 299.30999… in floats.
  assert.equal(sixth(3117.7 - 2818.39), 49.89);
});

test("VAT due by treatment", () => {
  const base = { saleHandledByJvb: true, costBaseGbp: 6000 };
  assert.equal(saleVat({ ...base, amount: 12000, vatTreatment: "margin_scheme" }), 1000);
  assert.equal(saleVat({ ...base, amount: 12000, vatTreatment: "standard" }), 2000);
  assert.equal(saleVat({ ...base, amount: 12000, vatTreatment: "zero_rated" }), 0);
  assert.equal(saleVat({ ...base, amount: 12000, vatTreatment: "outside_scope" }), 0);
  // Sold below cost: no margin, no VAT.
  assert.equal(saleVat({ ...base, amount: 5000, vatTreatment: "margin_scheme" }), 0);
  // Sold by a third party: no VAT for J.v.d.B.
  assert.equal(saleVat({ ...base, saleHandledByJvb: false, amount: 12000, vatTreatment: "standard" }), 0);
});

test("net profit is after VAT and costs", () => {
  const sale = { soldGbp: 12000, saleHandledByJvb: null, totalCostGbp: 6000, importVatPaidGbp: 0 };
  assert.equal(saleNetProfit({ ...sale, vatTreatment: "margin_scheme" }), 5000);
  assert.equal(saleNetProfit({ ...sale, vatTreatment: "standard" }), 4000);
  assert.equal(saleNetProfit({ ...sale, vatTreatment: "zero_rated" }), 6000);
  // Margin scheme with £300 import VAT paid: a cost, and off the taxable margin.
  // 12,000 − 6,300 = 5,700; VAT 950; profit 12,000 − 950 − 6,300 = 4,750.
  assert.equal(saleNetProfit({ ...sale, vatTreatment: "margin_scheme", importVatPaidGbp: 300 }), 4750);
  // Standard-rated: import VAT is reclaimable, not a cost.
  assert.equal(saleNetProfit({ ...sale, vatTreatment: "standard", importVatPaidGbp: 300 }), 4000);
});

test("the module's worked example", () => {
  const s = consignmentSplit({
    amount: 10000,
    vatTreatment: "zero_rated",
    saleHandledByJvb: true,
    purchaseCostGbp: 3000,
    extraCostsGbp: 500,
    importVatPaidGbp: 0,
    sharePct: 50,
  });
  assert.equal(s.profitPool, 9500);
  assert.equal(s.jvbNetProfit, 4750);
  assert.equal(s.jvbReceived, 5250);
  assert.equal(s.coOwnerShare, 4750);
});

test("the two shares always add up to the pool", () => {
  // £10,000 standard-rated at 50%: pool 8,333.33 once split 4,166.67 + 4,166.67.
  const a = consignmentSplit({
    amount: 10000,
    vatTreatment: "standard",
    saleHandledByJvb: true,
    purchaseCostGbp: 0,
    extraCostsGbp: 0,
    importVatPaidGbp: 0,
    sharePct: 50,
  });
  assert.equal(a.profitPool, 8333.33);
  assert.equal(a.jvbNetProfit, 4166.67);
  assert.equal(a.coOwnerShare, 4166.66);

  for (const amount of [999.99, 1024.09, 3117.7, 10000, 12345.67, 250000.01]) {
    for (const sharePct of [10, 25, 33.333, 40, 50, 60, 66.67, 75, 90]) {
      for (const vatTreatment of ["margin_scheme", "standard", "zero_rated"]) {
        const s = consignmentSplit({
          amount,
          vatTreatment,
          saleHandledByJvb: true,
          purchaseCostGbp: 400,
          extraCostsGbp: 123.45,
          importVatPaidGbp: 17.5,
          sharePct,
        });
        assert.equal(Math.round(s.jvbNetProfit * 100) + Math.round(s.coOwnerShare * 100), Math.round(s.profitPool * 100));
      }
    }
  }
});

test("J.v.d.B.'s share rounds half up, as jvb_share_gbp does", () => {
  // £1,024.09 zero-rated at 50%: 512.045 → 512.05 (floats gave 512.04).
  const s = consignmentSplit({
    amount: 1024.09,
    vatTreatment: "zero_rated",
    saleHandledByJvb: true,
    purchaseCostGbp: 0,
    extraCostsGbp: 0,
    importVatPaidGbp: 0,
    sharePct: 50,
  });
  assert.equal(s.jvbNetProfit, 512.05);
  assert.equal(s.coOwnerShare, 512.04);
  assert.equal(s.jvbReceived, 512.05);
});
