/*
 * The top of every page (spec sections 4 and 5): an optional back link, the
 * one <h1>, a meta line, and the page's actions on the right.
 *
 *   <PageHeader title back? meta? actions? className?>{children?}</PageHeader>
 *     title    the h1 text, in the title style (22px, light 300). Every page
 *              has exactly one.
 *     back     { href, label }: "← Inventory" above the title, caption size
 *              in meta.
 *     meta     one line under the title: a count ("869 works"), a stock
 *              number, a date. Pass tabular figures through formatCount.
 *     actions  buttons on the right; wraps below the title on a phone. At
 *              most one primary.
 *     children anything that belongs to the header below that row (a toolbar
 *              or a notice).
 *   On paper the back link and the actions are left out (print:hidden): a
 *   printed page keeps its title and meta line only.
 *
 * Server-safe: no state, usable from any page.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { ArrowLeftIcon } from "./icons";

export function PageHeader({
  title,
  back,
  meta,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cx("mb-6", className)}>
      {back ? (
        <Link
          href={back.href}
          className="mb-1 inline-flex items-center gap-1 text-[12px] leading-[1.4] text-meta hover:text-ink print:hidden"
        >
          <ArrowLeftIcon size={14} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-title text-ink">{title}</h1>
          {meta ? <p className="mt-1 text-[12px] leading-[1.4] text-meta">{meta}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
