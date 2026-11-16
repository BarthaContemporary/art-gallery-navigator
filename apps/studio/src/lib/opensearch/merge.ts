/*
 * How the two search legs are joined. Pure and import-free, so `node --test`
 * loads it as it is.
 *
 * Postgres always answers (pieces_search / crm_contacts_search, through the
 * signed-in user's client). OpenSearch adds matches and a better order when
 * it answers in time. The rules:
 *   1. With no OpenSearch answer the result is the Postgres order, untouched:
 *      exactly today's behaviour.
 *   2. A work whose stock number (current or legacy) contains the query comes
 *      first, exact match before partial, in the Postgres order. Postgres
 *      sees a work the instant it is saved; the index is seconds behind.
 *   3. Then OpenSearch's hits, in its order.
 *   4. Then whatever only Postgres found (a record edited seconds ago, a
 *      match inside a word such as "kimono" in "okimono"), in its order.
 * Nothing Postgres finds today is ever lost; an id only OpenSearch knows is
 * kept, and dropped later if the user's own query cannot load it (trashed,
 * erased or hidden by row level security since it was indexed).
 */

export type StockRow = { id: string; stock_number?: string | null; legacy_stock_number?: string | null };

const fold = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

/** 2 = the query is the stock number, 1 = it is part of one, 0 = neither. */
export function stockMatch(q: string, row: StockRow): 0 | 1 | 2 {
  const needle = fold(q);
  if (!needle) return 0;
  const numbers = [fold(row.stock_number), fold(row.legacy_stock_number)].filter(Boolean);
  if (numbers.includes(needle)) return 2;
  return numbers.some((n) => n.includes(needle)) ? 1 : 0;
}

export function mergeWorkIds(q: string, postgres: readonly StockRow[], openSearchIds: readonly string[] | null): string[] {
  if (openSearchIds === null) return postgres.map((r) => r.id);
  const exact: string[] = [];
  const partial: string[] = [];
  for (const row of postgres) {
    const m = stockMatch(q, row);
    if (m === 2) exact.push(row.id);
    else if (m === 1) partial.push(row.id);
  }
  return unique([...exact, ...partial, ...openSearchIds, ...postgres.map((r) => r.id)]);
}

/** Contacts and makers have no stock numbers: OpenSearch first, then the rest of Postgres. */
export function mergeIds(postgresIds: readonly string[], openSearchIds: readonly string[] | null): string[] {
  if (openSearchIds === null) return [...postgresIds];
  return unique([...openSearchIds, ...postgresIds]);
}

/** Rows in the order of `ids`; ids with no row (not loadable by this user) are dropped. */
export function inOrder<Row extends { id: string }>(ids: readonly string[], rows: readonly Row[]): Row[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: Row[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) out.push(row);
  }
  return out;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
