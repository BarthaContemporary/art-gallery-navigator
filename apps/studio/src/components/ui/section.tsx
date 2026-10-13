/*
 * Containers (spec section 4).
 *
 *   <Section title? meta? actions? id? className? level?>{children}</Section>
 *     The default container: a <section> with a rule-strong top edge, a
 *     heading (14.5px, 600, ink), an optional meta line under it and actions
 *     on the right. No fill, no box. Sections stack 24px apart: put them in a
 *     `space-y-6` parent. The editor's section rail finds these <section>s
 *     and their headings, so keep the title for editor panels.
 *       level  heading level, 2 by default (3 inside another Section).
 *
 *   <Panel title? actions? className?>{children}</Panel>
 *     An outlined group (1px rule, page fill, 16px padding) for a contained
 *     piece inside a page: the VAT working, the bulk bar, the consignment
 *     calculation. Not for whole page regions; those are Sections.
 *
 * Server-safe.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export function Section({
  title,
  meta,
  actions,
  id,
  className,
  level = 2,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  level?: 2 | 3;
  children?: ReactNode;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <section id={id} className={cx("section", className)}>
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
  className,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("panel", className)}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {title ? <h3 className="text-[13px] font-semibold leading-[1.45] text-ink">{title}</h3> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
