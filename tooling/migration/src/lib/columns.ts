/**
 * Exact column headers of the FileMaker export.
 * Several are deliberately odd — 'Purchase  cost' has TWO spaces,
 * 'Photograper' and 'Sold price in Defult Currency' are sic from FileMaker.
 */
export const COL = {
  category: "Category",
  consignmentDetails: "Consignment details",
  purchaseCost: "Purchase  cost", // sic: two spaces
  datePurchased: "Date purchased",
  container4: "Image | Container4",
  title: "Title",
  container1: "Image | Container1",
  container2: "Image | Container2",
  container3: "Image | Container3",
  container5: "Image | Container5",
  medium: "Medium",
  stockNumber: "Stock number",
  description: "Description",
  location: "Location",
  photographer: "Photograper", // sic
  published: "Published",
  shares: "Shares",
  markedPrice: "Marked price",
  status: "Status",
  restorationCost: "Restoration cost",
  comments: "Comments",
  soldPrice: "Sold price",
  profit: "Profit",
  otherCost: "Other cost",
  vat: "VAT",
  totalCost: "Total cost",
  netProfit: "Net profit",
  hIn: "H in",
  hInCm: "h in cm",
  inches: "inches",
  wInCm: "w in cm",
  lInCm: "l in cm",
  lInIn: "l in in",
  dInCm: "d in cm",
  dInIn: "d in in",
  item: "Item",
  manufacturer: "Manufacturer",
  document: "Document",
  dateModified: "Date Modified",
  modifiedBy: "Modified By",
  purchaseCurrency: "Purchase Currency",
  purchaseFx: "Purchase FX",
  purchaseCostDefault: "Purchase Cost in Default Currency",
  purchaseCostTotal: "Purchase Cost Total",
  sellCurrency: "Sell Currency",
  sellFx: "Sell FX",
  soldPriceDefault: "Sold price in Defult Currency", // sic
  vatYes: "VAT Yes",
  exhibitions: "Exhibitions::Exhibition",
  purchaseCostTotalGbp: "Purchase cost total ££",
} as const;

/** Image container columns in role order (Container1 = front). */
export const CONTAINER_COLUMNS = [
  COL.container1,
  COL.container2,
  COL.container3,
  COL.container4,
  COL.container5,
] as const;

/** One spreadsheet row: original sheet row number + values keyed by exact header. */
export interface RawRow {
  row_number: number;
  data: Record<string, unknown>;
}
