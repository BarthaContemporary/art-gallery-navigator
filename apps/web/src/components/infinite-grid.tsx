"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals a long grid in pages as the reader approaches the end
 * (IntersectionObserver), so the archive reads as infinite scroll while
 * the whole list still renders server-side for crawlers and no-JS.
 */
export function InfiniteGrid({
  children,
  pageSize = 12,
  className = "tiles",
}: {
  children: ReactNode[];
  pageSize?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(pageSize);
  // Index from which tiles were revealed by the reader (they enter with a
  // staggered fade); the first page renders still, so nothing flashes on load.
  const [animateFrom, setAnimateFrom] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const total = children.length;
  const reveal = () => {
    setVisible((v) => {
      setAnimateFrom(v);
      return Math.min(total, v + pageSize);
    });
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || visible >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, total, pageSize]);

  return (
    <>
      <ul className={className}>
        {Children.map(children.slice(0, visible), (child, i) => {
          if (animateFrom === null || i < animateFrom || !isValidElement<{ className?: string; style?: React.CSSProperties }>(child)) return child;
          const step = Math.min(i - animateFrom, 12);
          return cloneElement(child, {
            className: [child.props.className, "tile-in"].filter(Boolean).join(" "),
            style: { ...(child.props.style ?? {}), animationDelay: `${step * 30}ms` },
          });
        })}
      </ul>
      {visible < total ? (
        <div ref={sentinel} className="flex justify-center py-8">
          <noscript>
            <ul className={className}>{children.slice(visible)}</ul>
          </noscript>
          <button
            type="button"
            onClick={reveal}
            className="link-accent"
          >
            Show more
          </button>
        </div>
      ) : null}
    </>
  );
}
