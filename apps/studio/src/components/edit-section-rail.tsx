"use client";

import { useEffect, useRef, useState } from "react";

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

/**
 * Wayfinding for the long editor: one entry per titled <section> on the page
 * (inside the nearest [data-rail-root]), the panels below the main form
 * included. Read after mount, so role-gated sections just don't appear. Each
 * section gets an anchor id; the one nearest the top of the viewport is
 * marked current, with the accent rule the main navigation uses for place.
 */
export function EditSectionRail() {
  const ref = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string>("");

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

  // Always render the anchor so the effect can find the root; hide the bar
  // until sections are found.
  return (
    <nav
      ref={ref}
      aria-label="Sections of this record"
      data-inset-focus
      className={`-mb-px overflow-x-auto ${sections.length === 0 ? "hidden" : ""}`}
    >
      <ul className="flex w-max gap-4">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => jump(s.id)}
              aria-current={active === s.id ? "location" : undefined}
              className={`relative whitespace-nowrap border-b-2 py-2 text-[12px] font-medium leading-[1.4] ${
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
