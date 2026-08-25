/*
 * Include/exclude facet filters, one encoding everywhere.
 *
 * A facet parameter (status, category, location) carries either a plain value
 * — "show only these" — or the same value prefixed with "!" — "show all but
 * these". One parameter per facet keeps every existing surface working
 * unchanged: URL chips, saved live-list rules, export passthrough. This module
 * is the single decoder, so the inventory page, the exports and the live-list
 * resolver cannot disagree about what "!x" means.
 *
 * Exclusion is null-inclusive on nullable columns: "not category X" includes
 * works with no category at all. SQL's <> quietly drops NULL rows, which
 * would silently hide uncategorised works from an exclusion — exactly the
 * kind of wrong result nobody notices.
 */

export type Facet = { value: string; exclude: boolean };

export function parseFacet(raw: string | null | undefined): Facet | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("!")) {
    const value = s.slice(1);
    return value ? { value, exclude: true } : null;
  }
  return { value: s, exclude: false };
}

/** In-memory variant, for pre-fetched search hits. */
export function facetMatches(raw: string | null | undefined, actual: string | null): boolean {
  const f = parseFacet(raw);
  if (!f) return true;
  return f.exclude ? actual !== f.value : actual === f.value;
}

/** The slice of a PostgREST query builder these filters need. */
type FacetQuery<T> = {
  eq: (column: string, value: string) => T;
  neq: (column: string, value: string) => T;
  or: (filters: string) => T;
};

/**
 * Apply a facet to a query. `nullable` marks columns where NULL means "none
 * assigned" and must survive an exclusion.
 */
export function applyFacet<T extends FacetQuery<T>>(
  q: T,
  column: string,
  raw: string | null | undefined,
  opts: { nullable?: boolean } = {},
): T {
  const f = parseFacet(raw);
  if (!f) return q;
  if (!f.exclude) return q.eq(column, f.value);
  return opts.nullable ? q.or(`${column}.is.null,${column}.neq.${f.value}`) : q.neq(column, f.value);
}
