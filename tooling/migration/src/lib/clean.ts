import { COL, CONTAINER_COLUMNS, type RawRow } from "./columns.js";
import { parseBox } from "./box.js";
import { parseCurrency, toGbp } from "./currency.js";
import { resolveDimensions } from "./dimensions.js";
import { extractMaker } from "./maker.js";
import { proposeCategory, proposeStatus } from "./mappings.js";
import { normalizeStockNumber, stockStats } from "./stock.js";
import { toIsoDate, toNumber, toText } from "./values.js";

export interface CleanIssue {
  row_number: number;
  field: string;
  issue: string;
  raw_value: string;
}

export interface CleanedRow {
  row_number: number;
  stock_number: string | null;
  title: string | null;
  category_raw: string | null;
  medium: string | null;
  description: string | null;
  comments: string | null;
  location_raw: string | null;
  photographer: string | null;
  exhibitions_raw: string | null;
  consignment_details: string | null;

  // (a) dimensions
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  length_cm: number | null;
  diameter_cm: number | null;
  dimensions_display: string | null;

  // (b) maker proposal (never silently applied)
  proposed_maker: string | null;
  proposed_maker_life_dates: string | null;

  // (c) currency / financials
  purchase_date: string | null;
  purchase_cost: number | null;
  purchase_currency: string | null;
  purchase_fx: number | null;
  purchase_cost_gbp: number | null;
  restoration_cost: number | null;
  other_cost: number | null;
  marked_price: number | null;
  sold_price: number | null;
  sell_currency: string | null;
  sell_fx: number | null;
  sold_price_gbp: number | null;
  vat_yes: string | null;

  // (d) box / tomobako
  box_type: string | null;
  box_notes: string | null;

  // (e) status
  proposed_status: "sold" | "in_stock";
  status_signals: string[];

  // misc passthrough for finalize
  published_raw: string | null;
  status_raw: string | null;
  containers: Array<{ column: string; filename: string }>;
}

export interface CleanResult {
  rows: CleanedRow[];
  issues: CleanIssue[];
}

/** Run every cleaning pass over the raw rows. Pure — no I/O. */
export function cleanRows(rawRows: RawRow[]): CleanResult {
  const issues: CleanIssue[] = [];
  const push = (row_number: number, field: string, issue: string, raw_value: string) =>
    issues.push({ row_number, field, issue, raw_value });

  // (f) dataset-level stock number stats for duplicate flagging
  const stats = stockStats(rawRows);
  const duplicateStockNumbers = new Set(stats.duplicateValues.keys());

  const rows = rawRows.map((raw): CleanedRow => {
    const d = raw.data;
    const rn = raw.row_number;

    // (a) dimensions
    const dims = resolveDimensions(d);
    for (const di of dims.issues) push(rn, di.field, di.issue, di.raw_value);

    // (b) maker extraction — proposal only
    const description = toText(d[COL.description]);
    const title = toText(d[COL.title]);
    const maker = extractMaker(description, title);
    if (maker) {
      push(rn, maker.source === "description" ? COL.description : COL.title,
        "maker_proposed", maker.matched_text);
    }

    // (c) currency + GBP conversion
    const purchaseCurrencyRaw = toText(d[COL.purchaseCurrency]);
    const purchaseCurrency = parseCurrency(purchaseCurrencyRaw);
    if (purchaseCurrencyRaw && !purchaseCurrency) {
      push(rn, COL.purchaseCurrency, "currency_unknown", purchaseCurrencyRaw);
    }
    const sellCurrencyRaw = toText(d[COL.sellCurrency]);
    const sellCurrency = parseCurrency(sellCurrencyRaw);
    if (sellCurrencyRaw && !sellCurrency) {
      push(rn, COL.sellCurrency, "currency_unknown", sellCurrencyRaw);
    }

    const purchaseCost = toNumber(d[COL.purchaseCost]);
    const purchaseFx = toNumber(d[COL.purchaseFx]);
    const purchaseCostGbp = toGbp(purchaseCost, purchaseFx, purchaseCurrency);
    if (
      purchaseCost !== null &&
      purchaseFx === 1 &&
      purchaseCurrency !== null &&
      purchaseCurrency !== "GBP"
    ) {
      // A 1.0 rate on a foreign-currency purchase is almost certainly stale.
      push(rn, COL.purchaseFx, "fx_suspect_rate_1_for_foreign_currency",
        `${purchaseCurrency} ${purchaseCost}`);
    }
    if (purchaseCost !== null && purchaseCostGbp === null) {
      push(rn, COL.purchaseFx, "fx_missing_for_foreign_currency",
        `${purchaseCurrencyRaw ?? "?"} ${purchaseCost}`);
    }
    const soldPrice = toNumber(d[COL.soldPrice]);
    const sellFx = toNumber(d[COL.sellFx]);
    const soldPriceGbp = toGbp(soldPrice, sellFx, sellCurrency);

    // (d) box fields from 'Item'
    const box = parseBox(d[COL.item]);

    // (e) status resolution
    const signals: string[] = [];
    const categoryRaw = toText(d[COL.category]);
    if (categoryRaw && proposeCategory(categoryRaw).proposed_value === "sold") {
      signals.push(`Category='${categoryRaw}'`);
    }
    const statusRaw = toText(d[COL.status]);
    if (statusRaw && proposeStatus(statusRaw).proposed_value === "sold") {
      signals.push(`Status='${statusRaw}'`);
    }
    if (description?.trim().toLowerCase() === "sold") {
      signals.push("Description=='Sold'");
    }
    if (soldPrice !== null && soldPrice > 0) {
      signals.push(`Sold price=${soldPrice}`);
    }
    const proposedStatus: "sold" | "in_stock" = signals.length > 0 ? "sold" : "in_stock";
    if (proposedStatus === "sold") {
      push(rn, COL.status, "status_resolved_sold", signals.join(" & "));
    }

    // (f) stock number normalization + flags
    const stockNumber = normalizeStockNumber(d[COL.stockNumber]);
    if (stockNumber === null) {
      push(rn, COL.stockNumber, "stock_number_blank", "");
    } else if (duplicateStockNumbers.has(stockNumber)) {
      push(rn, COL.stockNumber, "stock_number_duplicate", stockNumber);
    }

    const containers = CONTAINER_COLUMNS.flatMap((column) => {
      const filename = toText(d[column]);
      return filename ? [{ column, filename }] : [];
    });

    return {
      row_number: rn,
      stock_number: stockNumber,
      title,
      category_raw: categoryRaw,
      medium: toText(d[COL.medium]),
      description,
      comments: toText(d[COL.comments]),
      location_raw: toText(d[COL.location]),
      photographer: toText(d[COL.photographer]),
      exhibitions_raw: toText(d[COL.exhibitions]),
      consignment_details: toText(d[COL.consignmentDetails]),

      height_cm: dims.height_cm,
      width_cm: dims.width_cm,
      depth_cm: dims.depth_cm,
      length_cm: dims.length_cm,
      diameter_cm: dims.diameter_cm,
      dimensions_display: dims.dimensions_display,

      proposed_maker: maker?.proposed_maker ?? null,
      proposed_maker_life_dates: maker?.life_dates ?? null,

      purchase_date: toIsoDate(d[COL.datePurchased]),
      purchase_cost: purchaseCost,
      purchase_currency: purchaseCurrency ?? purchaseCurrencyRaw,
      purchase_fx: purchaseFx,
      purchase_cost_gbp: purchaseCostGbp,
      restoration_cost: toNumber(d[COL.restorationCost]),
      other_cost: toNumber(d[COL.otherCost]),
      marked_price: toNumber(d[COL.markedPrice]),
      sold_price: soldPrice,
      sell_currency: sellCurrency ?? sellCurrencyRaw,
      sell_fx: sellFx,
      sold_price_gbp: soldPriceGbp,
      vat_yes: toText(d[COL.vatYes]),

      box_type: box.box_type,
      box_notes: box.box_notes,

      proposed_status: proposedStatus,
      status_signals: signals,

      published_raw: toText(d[COL.published]),
      status_raw: statusRaw,
      containers,
    };
  });

  return { rows, issues };
}

/** Issue counts keyed by issue type, descending. */
export function issueCounts(issues: CleanIssue[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const i of issues) counts.set(i.issue, (counts.get(i.issue) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}
