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

/**
 * Sticky wayfinding for the long edit form. Reads the form's own <section><h2>
 * headings after mount (so role-gated sections just don't appear), assigns
 * anchor ids, and renders a horizontal jump-bar with scrollspy. Clicking a
 * chip scrolls to that section; the visible section stays highlighted.
 */
export function EditSectionRail() {
  const ref = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const found: Section[] = [];
    form.querySelectorAll("section").forEach((el) => {
      const h = el.querySelector(":scope > h2");
      const label = h?.textContent?.trim();
      if (!label) return;
      const id = el.id || slug(label);
      el.id = id;
      (el as HTMLElement).style.scrollMarginTop = "calc(var(--app-header-h, 88px) + 52px)";
      found.push({ id, label });
    });
    setSections(found);
    if (found.length === 0) return;

    // Scrollspy — highlight the section nearest the top of the viewport.
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
    return () => observer.disconnect();
  }, []);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }

  // Always render the anchor so the effect can find the form; hide the bar
  // until we've discovered sections.
  return (
    <div
      ref={ref}
      style={{ top: "calc(var(--app-header-h, 88px) + 40px)" }}
      className={`sticky z-[9] -mx-1 mb-4 overflow-x-auto ${sections.length === 0 ? "hidden" : ""}`}
    >
      <div className="flex w-max gap-1 rounded-full border border-line-soft bg-cell/80 p-1 backdrop-blur-sm">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              active === s.id
                ? "bg-primary text-primary-fg"
                : "text-ink-mid hover:text-ink-strong"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
