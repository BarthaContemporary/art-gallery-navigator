"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Number ticker — digits count up to their value on mount (and re-count when
 * the value changes, e.g. a KPI period switch).
 *
 * Deliberately restrained: the dashboard is seen every session, and the more
 * often an animation is seen the shorter it should be. ~650ms, ease-out, and
 * it never animates from a previous value to a near-identical one.
 *
 * Callers must render this inside a `font-mono` (tabular-numerals) context so
 * the digits don't reflow as they tick — see .font-mono in globals.css.
 */
export function CountUp({
  value,
  format = (n) => n.toLocaleString("en-GB"),
  durationMs = 650,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    const delta = value - start;

    // Nothing meaningful to animate — jump.
    if (reduced || delta === 0) {
      from.current = value;
      setShown(value);
      return;
    }

    const t0 = performance.now();
    // Ease-out cubic: fast off the mark, gentle arrival (the default for UI).
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      setShown(start + delta * ease(t));
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
        setShown(value);
      }
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      // Leave the target value in place if we're interrupted mid-flight.
      from.current = value;
    };
  }, [value, durationMs, reduced]);

  // The ticking digits are decorative; assistive tech gets the settled value
  // directly. (aria-label on a generic <span> is not reliably announced, so
  // expose the real number as text instead.)
  return (
    <span className={className}>
      <span aria-hidden>{format(Math.round(shown))}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
