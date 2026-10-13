"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Section = { id: string; label: string };

const slug = (s: string) =>
  "sec-" +
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** The title of a section: a Section's heading, or an <h2> straight inside. */
function headingOf(el: Element): HTMLElement | null {
  return el.querySelector<HTMLElement>(":scope > .section-head h2, :scope > h2");
}

/** How far the fade at a scrolled edge reaches, and the room kept clear of it. */
const FADE = 32;

/**
 * Wayfinding for the long editor: one entry per titled <section> on the page
 * (inside the nearest [data-rail-root]), the panels below the main form
 * included. Read after mount, so role-gated sections just don't appear. Each
 * section gets an anchor id; the one nearest the top of the viewport is
 * marked current, with the accent rule the main navigation uses for place.
 *
 * Every section stays reachable. From tablet width the entries wrap onto as
 * many rows as they need. On a phone they keep to one row that scrolls
 * sideways: the edge with more entries beyond it fades out, so the row reads
 * as continuing, and the current entry is scrolled into view as the page
 * moves.
 */
export function EditSectionRail() {
  const ref = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string>("");
  // Whether there are entries out of view before and after (phone row only).
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const nav = ref.current;
    if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    const start = max > 1 && nav.scrollLeft > 1;
    const end = max > 1 && nav.scrollLeft < max - 1;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const root = ref.current?.closest("[data-rail-root]");
    if (!root) return;
    const found: Section[] = [];
    root.querySelectorAll("section").forEach((el) => {
      const label = headingOf(el)?.textContent?.trim();
      if (!label) return;
      const id = el.id || slug(label);
      el.id = id;
      found.push({ id, label });
    });
    setSections(found);
    if (found.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    found.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    // A link to a section (the stock book's "#sec-financials") names an id
    // that exists only from here on, too late for the browser's own jump.
    const target = decodeURIComponent(window.location.hash.slice(1));
    if (target && found.some((s) => s.id === target)) jump(target);
    return () => observer.disconnect();
  }, []);

  // Re-measure the edges whenever the row's size or its entries change.
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(nav);
    return () => resize.disconnect();
  }, [sections, measure]);

  // Keep the current entry in view on the scrolling row, clear of the fades.
  // When it has gone out of view it is brought to the start, where the row's
  // snap points are, so the entries after it show what comes next. Only the
  // row scrolls (never the page), so a smooth jump in progress carries on.
  useEffect(() => {
    const nav = ref.current;
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const item = nav.querySelector<HTMLElement>(`[data-rail-id="${CSS.escape(active)}"]`);
    if (!item) return;
    const frame = nav.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    if (box.left >= frame.left + (nav.scrollLeft > 0 ? FADE : 0) && box.right <= frame.right - FADE) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({
      left: Math.max(0, nav.scrollLeft + box.left - frame.left - FADE),
      behavior: still ? "auto" : "smooth",
    });
  }, [active]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // Clear the app header and this sticky bar, whatever their height today.
    const header =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-h")) || 88;
    const bar = ref.current?.parentElement?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - header - bar - 12;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: still ? "auto" : "smooth" });
    // Move focus with the view, so Tab carries on from the section reached.
    const heading = headingOf(el);
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    setActive(id);
  }

  // The phone row's fades: transparent at an edge with entries beyond it.
  const mask =
    edges.start || edges.end
      ? `linear-gradient(to right, ${edges.start ? "transparent" : "#000"} 0, #000 ${
          edges.start ? FADE : 0
        }px, #000 calc(100% - ${edges.end ? FADE : 0}px), ${edges.end ? "transparent" : "#000"} 100%)`
      : "none";

  // Always render the anchor so the effect can find the root; hide the bar
  // until sections are found.
  return (
    <nav
      ref={ref}
      aria-label="Sections of this record"
      data-inset-focus
      onScroll={measure}
      style={{ "--rail-mask": mask } as CSSProperties}
      className={`-mb-px overflow-x-auto overscroll-x-contain scroll-px-8 max-md:snap-x max-md:snap-proximity max-md:[-webkit-mask-image:var(--rail-mask)] max-md:[mask-image:var(--rail-mask)] md:overflow-visible ${
        sections.length === 0 ? "hidden" : ""
      }`}
    >
      <ul className="flex w-max gap-4 md:w-auto md:flex-wrap md:gap-y-0">
        {sections.map((s) => (
          <li key={s.id} className="snap-start">
            <button
              type="button"
              data-rail-id={s.id}
              onClick={() => jump(s.id)}
              aria-current={active === s.id ? "location" : undefined}
              className={`relative whitespace-nowrap border-b-2 py-2 text-[12px] font-medium leading-[1.4] md:py-1.5 ${
                active === s.id ? "border-accent text-ink" : "border-transparent text-meta hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
