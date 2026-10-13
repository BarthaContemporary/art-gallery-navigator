"use client";

/*
 * The scrolling box behind TableFrame. A table wider than its frame (the
 * stock book or the inventory on an iPad in landscape) used to end at the
 * frame's edge with nothing to say more columns sat beyond it. This marks
 * the frame with data-scroll-cue="left", "right" or "left right" while
 * there is more to scroll that way; globals.css fades that edge.
 *
 * The forwarded ref and onScroll still reach the caller (the inventory
 * mirrors its head's scroll through them).
 */
import { useCallback, useEffect, useRef, useState, type ComponentPropsWithRef } from "react";

export function ScrollFrame({ ref, onScroll, children, ...rest }: ComponentPropsWithRef<"div">) {
  const own = useRef<HTMLDivElement | null>(null);
  const [cue, setCue] = useState("");

  const measure = useCallback(() => {
    const el = own.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = [el.scrollLeft > 1 && "left", max - el.scrollLeft > 1 && "right"].filter(Boolean).join(" ");
    setCue((c) => (c === next ? c : next));
  }, []);

  useEffect(() => {
    const el = own.current;
    if (!el) return;
    measure();
    // The frame and its table both: a column resize changes only the table.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      own.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  return (
    <div
      {...rest}
      ref={setRef}
      data-scroll-cue={cue || undefined}
      onScroll={(e) => {
        measure();
        onScroll?.(e);
      }}
    >
      {children}
    </div>
  );
}
