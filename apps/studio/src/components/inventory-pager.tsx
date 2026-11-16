/*
 * The inventory's pager: previous and next as icon buttons around the page
 * numbers, the first and last page always among them, a gap (…) where pages
 * are skipped. One row at any width; quiet until hovered, the current page
 * in ink over an accent rule (the navigation's active mark).
 *
 *   <InventoryPager page pages href label className?>
 *     href   (page) => the URL of that page, keeping the view's filters and
 *            sort (the caller builds it).
 *     label  the nav's accessible name ("Pagination, top" / "…, bottom").
 *   Renders nothing for one page or none.
 *
 * Server-safe. Styles: .inv-page in app/globals.css (Inventory overview).
 */
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { pageWindow } from "@/lib/page-window";

export function InventoryPager({
  page,
  pages,
  href,
  label,
  className,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  label: string;
  className?: string;
}) {
  if (pages <= 1) return null;
  const first = page <= 1;
  const last = page >= pages;
  return (
    <nav aria-label={label} className={cx("flex items-center gap-0.5", className)}>
      <ButtonLink
        href={href(Math.max(1, page - 1))}
        variant="quiet"
        size="sm"
        iconOnly
        label="Previous page"
        disabled={first}
        icon={<ChevronLeftIcon size={16} />}
      />
      {pageWindow(page, pages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="inv-page-gap">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className="inv-page tabular"
          >
            {p}
          </Link>
        ),
      )}
      <ButtonLink
        href={href(Math.min(pages, page + 1))}
        variant="quiet"
        size="sm"
        iconOnly
        label="Next page"
        disabled={last}
        icon={<ChevronRightIcon size={16} />}
      />
    </nav>
  );
}
