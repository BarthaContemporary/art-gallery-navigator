/**
 * The page numbers the inventory pager shows (components/inventory-pager.tsx):
 * first, last, and the current page with one either side, a "gap" where pages
 * are skipped. A gap of a single page shows that page instead of "…".
 * Tested in page-window.test.ts.
 */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  const want = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  // A gap of a single page shows that page instead of "…".
  if (want.has(3) && pages >= 3) want.add(2);
  if (want.has(pages - 2) && pages >= 3) want.add(pages - 1);
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("gap");
    out.push(p);
  });
  return out;
}
