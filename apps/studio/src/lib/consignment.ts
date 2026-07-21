/**
 * Consignment / co-ownership settlement maths, in one place so the Financials
 * panel, the Consignment panel, the piece-detail overview and the dashboard all
 * agree.
 *
 * Rules (for a work on consignment or co-owned):
 *  - Margin-scheme VAT is worked out on the full cost base *including* the
 *    purchase cost (standard margin rules).
 *  - The pool that J.v.d.B. and the co-owner / consignee split ("shared net")
 *    is the amount less VAT only — the purchase cost is ignored here.
 *  - Restoration / other costs (and any import VAT paid) are carried by
 *    J.v.d.B. out of its own share, not deducted from the shared pool, so the
 *    co-owner / consignee is unaffected by them.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type ConsignmentInput = {
  /** Sold price (or the marked price when projecting an unsold work). */
  amount: number;
  vatTreatment: string;
  /** false → sold by a third party (no VAT for us; amount is already net). */
  saleHandledByJvb: boolean | null;
  /** Applied to margin-scheme VAT, ignored in the shared pool. */
  purchaseCostGbp: number;
  /** Restoration + other costs — borne by J.v.d.B. out of its share. */
  extraCostsGbp: number;
  /** Import VAT paid (only relevant on the margin scheme) — like extra costs. */
  importVatPaidGbp: number;
  /** J.v.d.B.'s percentage, 0–100. */
  sharePct: number;
};

export type ConsignmentSplit = {
  thirdParty: boolean;
  vat: number;
  /** Amount − VAT: the pool split by percentage (purchase cost excluded). */
  sharedNet: number;
  /** Restoration + other + import VAT, all carried by J.v.d.B. */
  jvbBorne: number;
  jvbShare: number;
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

  // Shared pool ignores the purchase cost — only VAT comes off it.
  const sharedNet = round2(Math.max(0, i.amount - vat));
  // J.v.d.B. carries restoration / other / import VAT out of its own share.
  const jvbBorne = round2(Math.max(0, i.extraCostsGbp) + importVatCost);
  const jvbShare = round2(pct * sharedNet - jvbBorne);
  const coOwnerShare = round2((1 - pct) * sharedNet);

  return { thirdParty, vat, sharedNet, jvbBorne, jvbShare, coOwnerShare };
}
