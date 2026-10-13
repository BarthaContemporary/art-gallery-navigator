/*
 * A key or shortcut, as text (spec section 2, "micro").
 *
 *   <Kbd boxed? className?>{key}</Kbd>
 *     A <kbd> in the sans at 11px. boxed (default) draws a 1px rule-strong
 *     key cap, for a shortcut shown on its own (the inventory's j / k / x);
 *     boxed={false} is the plain form for a hint inside a control or a
 *     footer line ("⌘K" in the search button). Write keys as they are
 *     printed on the keyboard: "⌘K", "Ctrl K", "Esc", "⏎".
 *
 * Server-safe.
 */
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export function Kbd({ boxed = true, className, ...rest }: ComponentPropsWithoutRef<"kbd"> & { boxed?: boolean }) {
  return (
    <kbd
      {...rest}
      className={cx(
        "font-sans text-[11px] font-normal",
        boxed
          ? "inline-block min-w-[16px] border border-rule-strong px-1 text-center leading-[16px] text-body"
          : "leading-none",
        className,
      )}
    />
  );
}
