/**
 * Sanitize a user-supplied term before interpolating it into a PostgREST
 * `.or(...)` / `.filter(...)` string. Commas separate OR-conditions and
 * parentheses group them, so an unescaped value could inject extra filter
 * nodes. We strip those metacharacters (and backslash); `%`/`*` are left as
 * harmless ILIKE wildcards.
 */
export function sanitizeFilterTerm(q: string): string {
  return q.replace(/[,()\\]/g, " ").replace(/\s+/g, " ").trim();
}
