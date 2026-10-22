"use client";

/*
 * Folding regions (spec section 5, motion). A region that opens and closes
 * by animating its grid row from 0fr to 1fr, so it needs no measured height
 * and content of any size works. The content fades as it folds.
 *
 *   <Collapse open id? className? innerClassName?>{content}</Collapse>
 *     The region alone, for a trigger you build yourself. Give the trigger
 *     aria-expanded={open} and aria-controls={id}. While closed the region is
 *     visibility: hidden once the fold has finished, so nothing in it can be
 *     tabbed to or read out; if focus was inside when it closes, focus moves
 *     to the element whose aria-controls names it. Once open and settled
 *     its overflow is released, so focus rings and menus inside are not
 *     clipped.
 *
 *   <Disclosure summary open? defaultOpen? onOpenChange? variant? size?
 *               className? panelClassName?>{content}</Disclosure>
 *     A Button (quiet and small by default) with a chevron that turns, and a
 *     Collapse under it. Uncontrolled with defaultOpen, or controlled with
 *     open and onOpenChange.
 *
 * Timing: 260ms on the shared in-out ease, opening and closing alike;
 * reduced motion makes it instant (the global reset in globals.css). Styles:
 * .jvb-collapse in app/globals.css.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { cx } from "./cx";
import { ChevronDownIcon } from "./icons";

/** Longest the fold takes; the settle step waits at most this long for transitionend. */
const FOLD_MS = 320;

export function Collapse({
  open,
  id,
  className,
  innerClassName,
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Settled: fully open, so overflow can be released. Starts settled when it
  // starts open, so a region open on first paint never clips.
  const [settled, setSettled] = useState(open);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!open) {
      setSettled(false);
      // Focus inside a region that is about to hide would be lost to <body>:
      // hand it to whatever controls the region.
      const el = ref.current;
      if (el && el.contains(document.activeElement) && el.id) {
        document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(el.id)}"]`)?.focus();
      }
      return;
    }
    // transitionend settles it; the timer covers a browser that does not
    // interpolate grid rows (it then jumps open and fires no event).
    const timer = setTimeout(() => setSettled(true), FOLD_MS + 40);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div
      ref={ref}
      id={id}
      data-open={open || undefined}
      data-settled={(open && settled) || undefined}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "grid-template-rows" && open) setSettled(true);
      }}
      className={cx("jvb-collapse", className)}
    >
      <div className={cx("jvb-collapse-inner", innerClassName)}>{children}</div>
    </div>
  );
}

export function Disclosure({
  summary,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  variant = "quiet",
  size = "sm",
  className,
  panelClassName,
  children,
}: {
  summary: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const id = useId();
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setInner(next);
    onOpenChange?.(next);
  };
  return (
    <div className={className}>
      <Button variant={variant} size={size} aria-expanded={open} aria-controls={id} onClick={toggle}>
        {summary}
        {/* Turns with aria-expanded (the .btn chevron rule in globals.css). */}
        <ChevronDownIcon size={14} />
      </Button>
      <Collapse id={id} open={open} className={panelClassName}>
        {children}
      </Collapse>
    </div>
  );
}
