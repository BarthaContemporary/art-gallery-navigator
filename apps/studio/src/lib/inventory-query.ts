import { applyFacet } from "@/lib/facet";
/*
 * The inventory list's filters, applied identically wherever they are honoured.
 *
 * The exports used to diverge — CSV and XLSX read only `status` while the DOCX
 * read status, category and location — which meant "export what I'm looking at"
 * quietly wasn't. One function now owns it, and the register filter came along
 * for free.
 */

/** Columns every export shares, in the order they read best. */
export const EXPORT_COLUMNS = [
  "stock_number",
  "legacy_stock_number",
  "title",
  "maker_name",
  "category_name",
  "medium",
  "period",
  "origin_region",
  "status",
  "location_code",
  "register",
] as const;

/** Human label for the register column; the raw enum would not read well. */
export function registerLabel(ledger: unknown): string {
  return ledger === "external" ? "Not JvdB" : "JvdB";
}

/**
 * Boolean "show only…" filters: URL param → vw_pieces_list column → pill
 * label. One table so the query branches, the exports and the pills can
 * never disagree about which flags exist.
 */
export const FLAG_FILTERS = [
  ["loan", "on_temp_export", "On temporary export"],
  ["needs", "needs_completion", "Needs completion"],
  ["nopurchase", "missing_purchase_gbp", "Needs purchase £"],
] as const;

export type FlagParam = (typeof FLAG_FILTERS)[number][0];

export function activeFlags(sp: Partial<Record<FlagParam, string | null | undefined>>) {
  return FLAG_FILTERS.filter(([param]) => Boolean(sp[param]));
}

// The constraint deliberately doesn't name T as eq's return type: a
// self-referential bound sends TypeScript into Supabase's builder generics
// ("type instantiation is excessively deep") at some call sites.
export function applyFlagFilters<T extends { eq: (column: string, value: unknown) => unknown }>(
  query: T,
  sp: Partial<Record<FlagParam, string | null | undefined>>,
): T {
  let q = query;
  for (const [, column] of activeFlags(sp)) q = q.eq(column, true) as T;
  return q;
}

/**
 * Apply the inventory URL's filters to a `vw_pieces_list` query.
 *
 * The register default matches the list itself: JvdB stock unless asked
 * otherwise, so an export taken without touching the filter never quietly
 * includes works the gallery does not own.
 */
export function applyInventoryFilters<
  T extends {
    eq: (column: string, value: unknown) => T;
    neq: (column: string, value: string) => T;
    or: (filters: string) => T;
  },
>(query: T, params: URLSearchParams): T {
  let q = query;
  for (const [param, column, nullable] of [
    ["status", "status", false],
    ["category", "category_id", true],
    ["location", "location_id", true],
  ] as const) {
    q = applyFacet(q, column, params.get(param), { nullable });
  }
  q = applyFlagFilters(q, {
    loan: params.get("loan"),
    needs: params.get("needs"),
    nopurchase: params.get("nopurchase"),
  });

  const ledger = params.get("ledger");
  if (ledger !== "all") q = q.eq("ledger", ledger === "external" ? "external" : "jvb");

  return q;
}

/** Row shaped for export: the view's columns plus a readable register label. */
export function toExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, register: registerLabel(row.ledger) };
}
