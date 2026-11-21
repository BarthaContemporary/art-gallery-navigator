"use client";

import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gridPlaceKey, gridPlaceSaver, readGridPlace } from "@/lib/grid-place";

/*
 * Coming Back to the grid: how many tiles were revealed and how far down
 * the reader was are kept per page in sessionStorage, and restored when the
 * page is reached by Back or Forward. Otherwise the grid would remount with
 * one page of tiles, the browser's remembered scroll position would lie
 * beyond the now much shorter page, and the reader would lose their place in
 * the archive after every event opened from deep in it. A fresh visit starts
 * at the top with one page, as before.
 */
let lastPopState = 0;
let firstMount = true;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastPopState = Date.now();
  });
}

/** True when this mount comes from Back or Forward (in-app, or a whole page restored from history). */
function cameBack(): boolean {
  const first = firstMount;
  firstMount = false;
  if (Date.now() - lastPopState < 3000) return true;
  if (!first) return false;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "back_forward";
  } catch {
    return false;
  }
}

/** sessionStorage, or null where reading it throws (blocked site data). */
function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

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
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // The page this grid belongs to, fixed at mount (see lib/grid-place.ts):
  // the address bar already shows the next page when the unmount cleanup
  // below runs, so the key is never read from it at save time.
  const placeKey = useRef<string | null>(null);

  // Back or Forward: reveal as many tiles as before, without the tile-in
  // stagger, before the first paint (the server markup is unchanged, so
  // hydration is too), then put the reader back where they were.
  const arrived = useRef(false);
  useLayoutEffect(() => {
    if (arrived.current) return; // once, on arrival
    arrived.current = true;
    placeKey.current ??= gridPlaceKey(window.location.pathname);
    if (!cameBack()) return;
    const saved = readGridPlace(session(), placeKey.current);
    if (!saved) return;
    const count = Math.min(total, Math.max(pageSize, saved.visible));
    if (count > visibleRef.current) setVisible(count);
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - saved.y) > 2) window.scrollTo(0, saved.y);
    });
  }, [total, pageSize]);

  // Remember the place on leaving: a layout-effect cleanup runs before the
  // next page resets the scroll; pagehide covers leaving the site. Both
  // write under the key taken at mount.
  useLayoutEffect(() => {
    placeKey.current ??= gridPlaceKey(window.location.pathname);
    const save = gridPlaceSaver(placeKey.current, () => ({ visible: visibleRef.current, y: window.scrollY }), session);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, []);
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

  // Every tile is in the server HTML, so crawlers find every link; tiles not
  // yet revealed carry `hidden`. Without JavaScript the style below shows them
  // all. Tailwind's preflight sets [hidden] to display:none !important inside
  // @layer base; a layered !important beats an unlayered one, so the override
  // sits in the same layer and wins on specificity.
  return (
    <>
      <noscript>
        <style>{`@layer base{.ig > li[hidden]{display:block!important}}.ig-more{display:none!important}`}</style>
      </noscript>
      <ul className={`${className} ig`}>
        {Children.map(children, (child, i) => {
          if (!isValidElement<{ className?: string; style?: React.CSSProperties; hidden?: boolean }>(child)) return child;
          if (i >= visible) return cloneElement(child, { hidden: true });
          if (animateFrom === null || i < animateFrom) return child;
          const step = Math.min(i - animateFrom, 12);
          return cloneElement(child, {
            className: [child.props.className, "tile-in"].filter(Boolean).join(" "),
            style: { ...(child.props.style ?? {}), animationDelay: `${step * 30}ms` },
          });
        })}
      </ul>
      {visible < total ? (
        <div ref={sentinel} className="ig-more flex justify-center py-8">
          <button type="button" onClick={reveal} className="link-accent">
            Show more
          </button>
        </div>
      ) : null}
    </>
  );
}
