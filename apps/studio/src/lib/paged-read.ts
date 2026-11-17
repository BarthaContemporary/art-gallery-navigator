/**
 * Read every row of a query, a page at a time.
 *
 * PostgREST can be capped (db-max-rows): a plain select then returns the
 * first N rows and says nothing. supabase/config.toml sets 1000 for the local
 * stack, and a cap is a common hardening step for the live one, so a full
 * read of a table that grows (the stock book, the contacts) must not rely on
 * one request. A larger .limit() does not help: the cap overrides it.
 *
 * The caller's query needs a total order (its sort plus a unique tie-break
 * such as id), or rows can be skipped or repeated between pages.
 *
 * Pages are read until one comes back empty, stepping by the rows actually
 * returned, so a cap below PAGE_ROWS still reads everything (at the cost of
 * one empty request at the end). Errors are thrown, never turned into a
 * short result: an export must fail rather than hand over part of a file.
 *
 * Self-contained on purpose (no imports): node --test runs it directly.
 */

/** Rows asked for per request; the local stack's cap. */
export const PAGE_ROWS = 1000;

/** Hard stop, far above any table here, so a misbehaving server cannot loop for ever. */
const MAX_PAGES = 1000;

export async function selectAllRows<Row>(
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  pageSize: number = PAGE_ROWS,
): Promise<Row[]> {
  const out: Row[] = [];
  let from = 0;
  for (let n = 0; n < MAX_PAGES; n++) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return out;
    out.push(...rows);
    from += rows.length;
  }
  throw new Error(`selectAllRows: more than ${MAX_PAGES} pages`);
}
