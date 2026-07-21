/**
 * Consignment / co-ownership settlement maths, in one place so the Financials
 * panel, the Consignment panel, the piece-detail overview and the dashboard all
 * agree.
 *
 * Rules (for a work on consignment or co-owned):
 *  - Margin-scheme VAT is worked out on the full cost base *including* the
 *    purchase cost (standard margin rules).
 *  - The purchase cost is ignored in the settlement (it's the consignor's).
 *  - Restoration / other costs (and any import VAT paid) are a *shared*
 *    expense: they come off the profit pool that both parties split by
 *    percentage, so each party's net profit drops by its share of the cost.
 *  - J.v.d.B. laid the cash out, so it is reimbursed those costs on top of its
 *    profit share — i.e. the costs are credited to J.v.d.B.'s received amount.
 *
 * Worked example — sold £10,000 zero-rated, £500 restoration, 50% share:
 *   profit pool 9,500 → net profit £4,750 each; J.v.d.B. receives 4,750 + 500
 *   = £5,250, the co-owner / consignee receives £4,750.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type ConsignmentInput = {
  /** Sold price (or the marked price when projecting an unsold work). */
  amount: number;
  vatTreatment: string;
  /** false → sold by a third party (no VAT for us; amount is already net). */
  saleHandledByJvb: boolean | null;
  /** Applied to margin-scheme VAT, ignored in the settlement. */
  purchaseCostGbp: number;
  /** Restoration + other costs — a shared expense, reimbursed to J.v.d.B. */
  extraCostsGbp: number;
  /** Import VAT paid (only relevant on the margin scheme) — like extra costs. */
  importVatPaidGbp: number;
  /** J.v.d.B.'s percentage, 0–100. */
  sharePct: number;
};

export type ConsignmentSplit = {
  thirdParty: boolean;
  vat: number;
  /** Amount − VAT: the total distributed between the two parties. */
  netAfterVat: number;
  /** Restoration + other + import VAT — the cash J.v.d.B. laid out. */
  jvbBorne: number;
  /** netAfterVat − costs: the pool split by percentage into net profit. */
  profitPool: number;
  /** J.v.d.B.'s net profit = share % of the profit pool. */
  jvbNetProfit: number;
  /** What J.v.d.B. actually receives = net profit + costs reimbursed. */
  jvbReceived: number;
  /** Co-owner / consignee's share = net profit = what they receive. */
  coOwnerShare: number;
};

export function consignmentSplit(i: ConsignmentInput): ConsignmentSplit {
  const thirdParty = i.saleHandledByJvb === false;
  const pct = i.sharePct / 100;
  const importVatCost = i.vatTreatment === "margin_scheme" ? Math.max(0, i.importVatPaidGbp) : 0;

  // VAT applies the full cost base (incl. purchase cost) on the margin scheme.
  const vatCostBase = Math.max(0, i.purchaseCostGbp) + Math.max(0, i.extraCostsGbp) + importVatCost;
  let vat = 0;
  if (!thirdParty) {
    if (i.vatTreatment === "margin_scheme") vat = Math.max(0, i.amount - vatCostBase) / 6;
    else if (i.vatTreatment === "standard") vat = i.amount / 6;
  }
  vat = round2(vat);

  const netAfterVat = round2(Math.max(0, i.amount - vat));
  // Restoration / other / import VAT: a shared expense off the profit pool,
  // reimbursed to J.v.d.B. (which laid the cash out).
  const jvbBorne = round2(Math.max(0, i.extraCostsGbp) + importVatCost);
  const profitPool = round2(Math.max(0, netAfterVat - jvbBorne));
  const jvbNetProfit = round2(pct * profitPool);
  const coOwnerShare = round2((1 - pct) * profitPool);
  const jvbReceived = round2(jvbNetProfit + jvbBorne);

  return { thirdParty, vat, netAfterVat, jvbBorne, profitPool, jvbNetProfit, jvbReceived, coOwnerShare };
}
