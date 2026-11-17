"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Focus handling for a modal layer drawn in the page (role="dialog"
 * aria-modal="true"), the way the app header's menu does it:
 *
 *   - on open, focus moves in: to `initial()` if given, else the first control;
 *   - Tab and Shift+Tab cycle through its controls and never reach the page
 *     behind (and focus that lands outside anyway, say tabbing out of a PDF
 *     iframe, is brought back);
 *   - Escape calls `onEscape`;
 *   - on close (or unmount) focus goes back to `returnTo()`, or else to what
 *     had focus when it opened, if that is still in the page.
 *
 *   const ref = useRef<HTMLDivElement>(null);
 *   useModalFocus(open, ref, { initial, returnTo, onEscape });
 */
export function useModalFocus(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  opts: {
    initial?: () => HTMLElement | null | undefined;
    returnTo?: () => HTMLElement | null | undefined;
    onEscape?: () => void;
  } = {},
) {
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    (latest.current.initial?.() ?? focusables()[0] ?? ref.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (latest.current.onEscape) {
          e.preventDefault();
          latest.current.onEscape();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const inside = Boolean(active && ref.current?.contains(active));
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (ref.current && t instanceof Node && !ref.current.contains(t)) focusables()[0]?.focus();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      const back = latest.current.returnTo?.() ?? (opener && opener.isConnected ? opener : null);
      back?.focus();
    };
  }, [open, ref]);
}
