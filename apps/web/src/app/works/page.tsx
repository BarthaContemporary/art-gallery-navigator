import type { Metadata } from "next";
import Link from "next/link";
import { sanityFetch, worksQuery, type WorkListResult } from "@/lib/sanity";
import { WorkGrid } from "@/components/work-card";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Works",
  description:
    "Browse available Japanese and Indian works of art — bronzes, metalwork, okimono and fine objects.",
};

function pageHref(category: string, page: number): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/works?${qs}` : "/works";
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const category = sp.category ?? "";
  const pageNumber = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const result = await sanityFetch<WorkListResult>({
    query: worksQuery,
    params: { category, offset, end: offset + PAGE_SIZE },
    tags: ["work"],
    fallback: { items: [], total: 0, categories: [] },
  });

  // Distinct categories for the filter chips.
  const categoryMap = new Map<string, string>();
  for (const c of result.categories) {
    if (c.categorySlug && c.category) categoryMap.set(c.categorySlug, c.category);
  }
  const categories = [...categoryMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Works</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {result.total > 0
            ? `${result.total} work${result.total === 1 ? "" : "s"} available. Prices on application unless stated.`
            : "Prices on application unless stated."}
        </p>
      </header>

      {categories.length > 0 ? (
        <nav aria-label="Filter by category" className="mb-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/works"
                aria-current={category === "" ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-control border px-3.5 py-1.5 text-sm transition-colors ${
                  category === ""
                    ? "border-line-control-active bg-control-active text-ink-strong"
                    : "border-line-control bg-control text-ink-mid hover:bg-control-active"
                }`}
              >
                All
              </Link>
            </li>
            {categories.map(([slug, label]) => (
              <li key={slug}>
                <Link
                  href={pageHref(slug, 1)}
                  aria-current={category === slug ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-control border px-3.5 py-1.5 text-sm transition-colors ${
                    category === slug
                      ? "border-line-control-active bg-control-active text-ink-strong"
                      : "border-line-control bg-control text-ink-mid hover:bg-control-active"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <WorkGrid works={result.items} />

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-12 flex items-center justify-between border-t border-line-soft pt-6 text-sm"
        >
          {pageNumber > 1 ? (
            <Link
              href={pageHref(category, pageNumber - 1)}
              className="text-ink-mid hover:text-ink-strong"
            >
              &larr; Previous
            </Link>
          ) : (
            <span aria-hidden className="text-ink-faint">
              &larr; Previous
            </span>
          )}
          <span className="font-mono text-xs text-ink-soft">
            {pageNumber} / {totalPages}
          </span>
          {pageNumber < totalPages ? (
            <Link
              href={pageHref(category, pageNumber + 1)}
              className="text-ink-mid hover:text-ink-strong"
            >
              Next &rarr;
            </Link>
          ) : (
            <span aria-hidden className="text-ink-faint">
              Next &rarr;
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
