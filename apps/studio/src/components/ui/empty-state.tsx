/*
 * Empty states (spec section 4): one sentence that says why there is nothing
 * here, and one action that changes it.
 *
 *   <EmptyState action? className?>{sentence}</EmptyState>
 *     action  a single Button or ButtonLink ("New record", "Clear filters").
 *
 * In a table use EmptyRow (./table) instead, which spans the columns.
 * Server-safe.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export function EmptyState({
  action,
  className,
  children,
}: {
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("px-4 py-10 text-center", className)}>
      <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.45] text-body">{children}</p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
