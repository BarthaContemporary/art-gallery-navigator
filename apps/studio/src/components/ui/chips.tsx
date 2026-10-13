/*
 * Chips (spec section 4): filters and toggles. At rest a rule-strong edge
 * and body text; pressed or current is an ink fill with page text, a change
 * of shape and contrast rather than of colour alone.
 *
 *   <SegmentedLinks items current aria-label? className?>
 *     One choice of several, each a URL (a status filter, a period). Joined
 *     chips rendered as next/link; the item whose value equals `current` gets
 *     aria-current="page". Build each href with the page's other query
 *     parameters kept, so a facet never wipes the rest of the filter.
 *       items  { value, label, href, count?, title? }[]; count prints after
 *              the label in tabular figures; title is a tooltip (a quarter's
 *              date range), never the only place a meaning is given.
 *
 *   <ToggleChip pressed …button props>{label}</ToggleChip>
 *     An on/off filter: a native <button> with aria-pressed. type defaults to
 *     "button"; name, value, type="submit" and onClick pass through, so it
 *     works in a server-action form as well as in a client component.
 *
 *   chipClass(extra?)  the class string for a chip-looking element these do
 *     not cover.
 *
 * Server-safe.
 */
import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

export function chipClass(className?: string): string {
  return cx("chip", className);
}

export type SegmentedItem = {
  value: string;
  label: ReactNode;
  href: string;
  count?: number | string;
  title?: string;
};

export function SegmentedLinks({
  items,
  current,
  className,
  "aria-label": ariaLabel,
}: {
  items: SegmentedItem[];
  current: string | null | undefined;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cx("segmented", className)}>
      {items.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          title={item.title}
          aria-current={item.value === current ? "page" : undefined}
          className="chip"
        >
          {item.label}
          {item.count !== undefined ? <span className="chip-count">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function ToggleChip({
  pressed,
  type = "button",
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<"button">, "aria-pressed"> & { pressed: boolean }) {
  return (
    <button {...rest} type={type} aria-pressed={pressed} className={chipClass(className)}>
      {children}
    </button>
  );
}
