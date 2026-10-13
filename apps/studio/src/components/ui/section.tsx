/*
 * Containers (spec section 4).
 *
 *   <Section title? meta? actions? level? …section props>{children}</Section>
 *     The default container: a <section> with a rule-strong top edge, a
 *     heading (14.5px, 600, ink), an optional meta line under it and actions
 *     on the right. No fill, no box. Sections stack 24px apart: put them in a
 *     `space-y-6` parent. The editor's section rail finds these <section>s
 *     and their headings, so keep the title for editor panels.
 *       level  heading level, 2 by default (3 inside another Section).
 *       Every other prop (id, className, data-rail, aria-*, style) goes to
 *       the <section> itself. `title` is the heading, not the HTML title
 *       attribute.
 *
 *   <Panel title? actions? level? compact? className?>{children}</Panel>
 *     An outlined group (1px rule, page fill, 16px padding) for a contained
 *     piece inside a page: the VAT working, the bulk bar, the consignment
 *     calculation. Not for whole page regions; those are Sections.
 *       level    the title's heading level, 3 by default (2 where a Panel
 *                stands at the top of a page region, 4 deeper down).
 *       compact  12px padding instead of 16px, for a dense group.
 *
 * Server-safe.
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";

export function Section({
  title,
  meta,
  actions,
  className,
  level = 2,
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3;
  children?: ReactNode;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <section {...rest} className={cx("section", className)}>
      {title || actions ? (
        <div className="section-head">
          <div className="min-w-0">
            {title ? <Heading className="section-title">{title}</Heading> : null}
            {meta ? <p className="section-meta">{meta}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Panel({
  title,
  actions,
  level = 3,
  compact = false,
  className,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3 | 4;
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : level === 4 ? "h4" : "h3";
  return (
    <div className={cx("panel", compact && "p-3", className)}>
      {title || actions ? (
        <div className={cx("flex flex-wrap items-baseline justify-between gap-2", compact ? "mb-2" : "mb-3")}>
          {title ? <Heading className="text-[13px] font-semibold leading-[1.45] text-ink">{title}</Heading> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
