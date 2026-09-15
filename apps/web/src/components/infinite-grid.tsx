"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const sentinel = useRef<HTMLDivElement>(null);
  const total = children.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || visible >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((v) => Math.min(total, v + pageSize));
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, total, pageSize]);

  return (
    <>
      <ul className={className}>{children.slice(0, visible)}</ul>
      {visible < total ? (
        <div ref={sentinel} className="flex justify-center py-8">
          <noscript>
            <ul className={className}>{children.slice(visible)}</ul>
          </noscript>
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(total, v + pageSize))}
            className="link-accent"
          >
            Show more
          </button>
        </div>
      ) : null}
    </>
  );
}
