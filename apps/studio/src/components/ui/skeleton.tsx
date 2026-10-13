/*
 * Loading placeholders (spec section 4): the .jvb-shimmer sheen only, the one
 * skeleton look in the studio (no animate-pulse). The global reduced-motion
 * rule stills the sheen.
 *
 *   <Skeleton width? height? className?>  one block, aria-hidden. width is
 *     any CSS length (default 100%), height in px (default 12).
 *   <SkeletonText lines? label?>          a paragraph of lines.
 *   <SkeletonTable rows? columns? label?> table rows on hairlines, for a
 *     table page's loading.tsx.
 *   The two composites are role="status" with a visually hidden label
 *   ("Loading" by default), so a screen reader hears one word, not a list of
 *   empty blocks.
 *
 * Server-safe.
 */
import type { CSSProperties } from "react";
import { cx } from "./cx";

export function Skeleton({
  width = "100%",
  height = 12,
  className,
  style,
}: {
  width?: number | string;
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <span aria-hidden className={cx("jvb-shimmer block", className)} style={{ width, height, ...style }} />;
}

// Varied line lengths read as text rather than as a grid of bars.
const LINE_WIDTHS = ["92%", "100%", "84%", "96%", "70%"];

export function SkeletonText({ lines = 3, label = "Loading", className }: { lines?: number; label?: string; className?: string }) {
  return (
    <div role="status" className={cx("relative space-y-2", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : LINE_WIDTHS[i % LINE_WIDTHS.length]} />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 8,
  columns = 5,
  label = "Loading",
  className,
}: {
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cx("relative", className)}>
      <span className="sr-only">{label}</span>
      <div className="flex gap-4 border-b border-rule-strong px-3 py-2.5">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} height={10} width={c === 1 ? "28%" : "12%"} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-rule px-3 py-[var(--jvb-row-py)]">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} height={12} width={c === 1 ? "28%" : "12%"} />
          ))}
        </div>
      ))}
    </div>
  );
}
