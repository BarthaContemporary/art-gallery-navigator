/*
 * The pager for index pages (spec section 5): one anatomy everywhere, as the
 * inventory first drew it.
 *
 *   <Pager page pages href label? className?>
 *     First · Previous · "Page n of m" · Next · Last, as small secondary
 *     ButtonLinks in a <nav>. The ends are disabled (an inert span) on the
 *     first and last page. Renders nothing when there is one page or none.
 *       page   the current page, from 1.
 *       pages  how many pages there are.
 *       href   (page) => the URL of that page. The caller builds it, keeping
 *              the view's other query parameters (filters, sort) so paging
 *              never drops them; only the page changes.
 *       label  the nav's accessible name. A page that shows the pager above
 *              and below the results names them apart: "Pagination, top",
 *              "Pagination, bottom".
 *       className  placement (mt-4 justify-end under a table).
 *
 * Server-safe: href is called during render, so a server page passes a
 * plain function.
 */
import { ButtonLink } from "./button";
import { cx } from "./cx";

export function Pager({
  page,
  pages,
  href,
  label = "Pagination",
  className,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  label?: string;
  className?: string;
}) {
  if (pages <= 1) return null;
  const first = page <= 1;
  const last = page >= pages;
  return (
    <nav aria-label={label} className={cx("flex flex-wrap items-center gap-1.5", className)}>
      <ButtonLink href={href(1)} size="sm" disabled={first}>
        First
      </ButtonLink>
      <ButtonLink href={href(Math.max(1, page - 1))} size="sm" disabled={first}>
        Previous
      </ButtonLink>
      <span className="tabular px-1.5 text-[12px] text-meta">
        Page {page} of {pages}
      </span>
      <ButtonLink href={href(Math.min(pages, page + 1))} size="sm" disabled={last}>
        Next
      </ButtonLink>
      <ButtonLink href={href(pages)} size="sm" disabled={last}>
        Last
      </ButtonLink>
    </nav>
  );
}
