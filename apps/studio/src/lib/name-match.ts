/**
 * Finding a name typed into a form among existing rows, the same name in any
 * case and nothing else: the reuse-before-create lookups for categories,
 * origin regions and makers.
 *
 * `.ilike(column, name)` alone reads `%` and `_` in the name as wildcards,
 * and PostgREST turns every `*` into `%`, even after a backslash, so a name
 * with one of them was taken for a different row ("Lacquer*" found "Lacquer
 * ware"). namePattern() escapes `%`, `_` and `\`, and makes `*` the
 * one-character wildcard, which still finds a row spelled with a `*`;
 * pickSameName() then keeps only a row whose name is the same.
 */

/** How many rows a lookup reads before picking: a name and its look-alikes. */
export const NAME_CANDIDATES = 20;

const SPECIAL = /[\\%_*]/;

/** An ILIKE pattern that finds `name` and, for a name with `*`, a few look-alikes. */
export function namePattern(name: string): string {
  return name.replace(/[\\%_*]/g, (c) => (c === "*" ? "_" : `\\${c}`));
}

/**
 * The row whose name is `name` once case is set aside. For a name with none
 * of `\ % _ *` the pattern was the name itself, so every row the database
 * returned is that name and the first is taken, as before; otherwise the
 * names are compared here.
 */
export function pickSameName<T>(
  rows: readonly T[] | null | undefined,
  name: string,
  nameOf: (row: T) => string | null | undefined,
): T | undefined {
  const list = rows ?? [];
  if (!SPECIAL.test(name)) return list[0];
  const want = name.toLowerCase();
  return list.find((r) => (nameOf(r) ?? "").toLowerCase() === want);
}
