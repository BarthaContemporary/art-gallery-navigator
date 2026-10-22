/*
 * Empty states (spec section 4): the Moon Gate mark, quiet (its square in
 * rule-strong, the seal in the accent), one sentence that says why there is
 * nothing here, and one action that changes it.
 *
 *   <EmptyState action? compact? className?>{sentence}</EmptyState>
 *     action   a single Button or ButtonLink ("New record", "Clear filters").
 *     compact  less air and a smaller mark, for a section within a page (a
 *              folded panel, a record's item list) rather than the page's
 *              one list.
 *
 * In a table use EmptyRow (./table) instead, which spans the columns.
 * Server-safe.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";
import { MoonGateMark } from "./moon-gate";

export function EmptyState({
  action,
  compact = false,
  className,
  children,
}: {
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("px-4 text-center", compact ? "py-6" : "py-10", className)}>
      <MoonGateMark size={compact ? 22 : 28} className={cx("mx-auto block text-rule-strong", compact ? "mb-2" : "mb-3")} />
      <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.45] text-body">{children}</p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
