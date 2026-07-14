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

  const categoryMap = new Map<string, string>();
  for (const c of result.categories) {
    if (c.categorySlug && c.category) categoryMap.set(c.categorySlug, c.category);
  }
  const categories = [...categoryMap.entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center border px-4 py-1.5 font-sans text-ui transition-colors ${
      active
        ? "border-oranje text-oranje"
        : "border-hairline text-ink-70 hover:border-sumi hover:text-sumi"
    }`;

  return (
    <div className="page py-16">
      <header className="grid12">
        <div className="col-span-12 md:col-span-8">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            Works
          </h1>
          <p className="mt-4 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
            {result.total > 0
              ? `${result.total} work${result.total === 1 ? "" : "s"} available. Prices on application unless stated.`
              : "Prices on application unless stated."}
          </p>
        </div>
      </header>

      {categories.length > 0 ? (
        <nav aria-label="Filter by category" className="mt-12">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/works"
                aria-current={category === "" ? "page" : undefined}
                className={chip(category === "")}
              >
                All
              </Link>
            </li>
            {categories.map(([slug, label]) => (
              <li key={slug}>
                <Link
                  href={pageHref(slug, 1)}
                  aria-current={category === slug ? "page" : undefined}
                  className={chip(category === slug)}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mt-12">
        <WorkGrid works={result.items} />
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-[var(--section)] flex items-center justify-between pt-6 font-sans text-ui"
        >
          {pageNumber > 1 ? (
            <Link
              href={pageHref(category, pageNumber - 1)}
              className="link-inline text-ink-70"
            >
              &larr; Previous
            </Link>
          ) : (
            <span aria-hidden className="text-ink-50">
              &larr; Previous
            </span>
          )}
          <span className="label">
            {pageNumber} / {totalPages}
          </span>
          {pageNumber < totalPages ? (
            <Link
              href={pageHref(category, pageNumber + 1)}
              className="link-inline text-ink-70"
            >
              Next &rarr;
            </Link>
          ) : (
            <span aria-hidden className="text-ink-50">
              Next &rarr;
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
