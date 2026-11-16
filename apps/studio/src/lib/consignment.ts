/**
 * Sale VAT and consignment / co-ownership settlement maths, in one place so
 * the Financials panel, the Consignment panel, the piece-detail overview and
 * the dashboard all agree, with each other and with the stock book's views.
 *
 * VAT (CLAUDE.md, Money / VAT): margin scheme 1/6 of (sale − total cost),
 * import VAT paid counting as a cost; standard 1/6 of the sale; zero-rated
 * and outside scope none; and none for J.v.d.B. when a third party handled
 * the sale. Every sixth is taken in whole pence and rounded half up, as the
 * views' round(x / 6, 2) does: in floating point £299.31 / 6 came out a
 * penny below the stock book.
 *
 * Settlement rules (for a work on consignment or co-owned):
 *  - Margin-scheme VAT is worked out on the full cost base *including* the
 *    purchase cost (standard margin rules).
 *  - The purchase cost is ignored in the settlement (it's the consignor's).
 *  - Restoration / other costs (and any import VAT paid) are a *shared*
 *    expense: they come off the profit pool that both parties split by
 *    percentage, so each party's net profit drops by its share of the cost.
 *  - J.v.d.B. laid the cash out, so it is reimbursed those costs on top of its
 *    profit share — i.e. the costs are credited to J.v.d.B.'s received amount.
 *  - The pool is split in whole pence: J.v.d.B.'s share is rounded half up
 *    (as the views' jvb_share_gbp is) and the co-owner has the rest, so the
 *    two always add up to the pool.
 *
 * Worked example — sold £10,000 zero-rated, £500 restoration, 50% share:
 *   profit pool 9,500 → net profit £4,750 each; J.v.d.B. receives 4,750 + 500
 *   = £5,250, the co-owner / consignee receives £4,750.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whole pence of an amount in pounds. */
const pence = (n: number) => Math.round(n * 100);

/** One sixth of an amount, to the penny, half away from zero (Postgres round(x / 6, 2)). */
export function sixth(amount: number): number {
  const p = pence(amount);
  return (Math.sign(p) * Math.round(Math.abs(p) / 6)) / 100;
}

export type SaleVatInput = {
  /** Sale £ (or the marked price when projecting an unsold work). */
  amount: number;
  vatTreatment: string;
  /** false → sold by a third party: no VAT for J.v.d.B. */
  saleHandledByJvb: boolean | null;
  /** Total cost the margin is worked on, import VAT paid included on the margin scheme. */
  costBaseGbp: number;
};

/** VAT due on a sale, by its treatment. */
export function saleVat(i: SaleVatInput): number {
  if (i.saleHandledByJvb === false) return 0;
  if (i.vatTreatment === "margin_scheme") return sixth(Math.max(0, i.amount - i.costBaseGbp));
  if (i.vatTreatment === "standard") return sixth(i.amount);
  return 0;
}

export type SaleProfitInput = {
  soldGbp: number;
  vatTreatment: string;
  saleHandledByJvb: boolean | null;
  /** Purchase + restoration + other costs. */
  totalCostGbp: number;
  /** Import VAT paid. A cost on the margin scheme; otherwise reclaimable input VAT. */
  importVatPaidGbp: number;
};

/**
 * What a sale made after VAT and costs: sale − VAT due − total cost − import
 * VAT paid on the margin scheme (Net = sale − VAT, less what the work cost).
 */
export function saleNetProfit(i: SaleProfitInput): number {
  const importVatCost = i.vatTreatment === "margin_scheme" ? Math.max(0, i.importVatPaidGbp) : 0;
  const costBase = i.totalCostGbp + importVatCost;
  const vat = saleVat({
    amount: i.soldGbp,
    vatTreatment: i.vatTreatment,
    saleHandledByJvb: i.saleHandledByJvb,
    costBaseGbp: costBase,
  });
  return (pence(i.soldGbp) - pence(vat) - pence(costBase)) / 100;
}

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
  const importVatCost = i.vatTreatment === "margin_scheme" ? Math.max(0, i.importVatPaidGbp) : 0;

  // VAT applies the full cost base (incl. purchase cost) on the margin scheme.
  const vatCostBase = Math.max(0, i.purchaseCostGbp) + Math.max(0, i.extraCostsGbp) + importVatCost;
  const vat = saleVat({
    amount: i.amount,
    vatTreatment: i.vatTreatment,
    saleHandledByJvb: i.saleHandledByJvb,
    costBaseGbp: vatCostBase,
  });

  const netP = Math.max(0, pence(i.amount) - pence(vat));
  // Restoration / other / import VAT: a shared expense off the profit pool,
  // reimbursed to J.v.d.B. (which laid the cash out).
  const borneP = pence(Math.max(0, i.extraCostsGbp) + importVatCost);
  const poolP = Math.max(0, netP - borneP);
  // Half up, as the views' round(pct / 100 * pool, 2). The share is an
  // unconstrained numeric (33.333 is allowed), so it is not rounded first;
  // the epsilon absorbs float error in an exact half.
  const jvbP = Math.floor((poolP * i.sharePct) / 100 + 0.5 + 1e-9);
  const coOwnerP = poolP - jvbP;

  return {
    thirdParty,
    vat,
    netAfterVat: netP / 100,
    jvbBorne: borneP / 100,
    profitPool: poolP / 100,
    jvbNetProfit: jvbP / 100,
    jvbReceived: (jvbP + borneP) / 100,
    coOwnerShare: coOwnerP / 100,
  };
}
