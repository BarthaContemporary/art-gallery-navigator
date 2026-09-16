"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RatioImage } from "./ratio-image";
import { RATIO, type SanityImage } from "@/lib/sanity";

export type Slide = {
  key: string;
  image: SanityImage | null;
  eyebrow: string;
  title: string;
  meta: string | null;
  href: string | null;
};

const INTERVAL_MS = 6500;

/**
 * 16:9 hero slideshow (handoff 2a/2b). Crossfade every ~6.5s, pauses on
 * hover, swipe on touch, ← → on the keyboard. Markers are short bars
 * bottom-right, the active one orange. Caption sits bottom-left on a
 * translucent white block. Reduced motion: no crossfade, no autoplay.
 */
export function HeroSlideshow({
  slides,
  priority = true,
  caption = true,
}: {
  slides: Slide[];
  priority?: boolean;
  /** Set false on event pages where the text block below carries the title. */
  caption?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)),
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [count, paused, go]);

  if (count === 0) return null;
  const active = slides[Math.min(index, count - 1)] ?? slides[0]!;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Current and forthcoming events"
      className="relative w-full overflow-hidden bg-field"
      style={{ aspectRatio: String(RATIO.hero) }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined) return;
        if (end - start > 40) go(-1);
        else if (start - end > 40) go(1);
      }}
      tabIndex={count > 1 ? 0 : -1}
    >
      {slides.map((s, i) => (
        <div
          key={s.key}
          className="slide"
          data-active={i === index}
          aria-hidden={i !== index}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${count}`}
        >
          <RatioImage
            image={s.image}
            ratio={RATIO.hero}
            width={1920}
            alt={s.title}
            sizes="100vw"
            priority={priority && i === 0}
            lazy={false}
            className="h-full"
          />
        </div>
      ))}

      {/* The whole slide is the link to the event; the caption sits above it. */}
      {active.href ? (
        <Link href={active.href} className="absolute inset-0 z-[1]" aria-label={active.title} />
      ) : null}

      {caption ? (
        <div className="pointer-events-none absolute bottom-0 left-0 z-[2] max-w-[min(520px,92%)] bg-white/85 px-5 py-4 backdrop-blur-[2px] md:bottom-6 md:left-6 md:px-7 md:py-6">
          <p className="eyebrow">{active.eyebrow}</p>
          <h2 className="mt-1.5 font-sans text-[20px] font-light leading-tight text-ink md:text-[22px]">
            {active.href ? (
              <Link href={active.href} className="pointer-events-auto hover:text-accent">
                {active.title}
              </Link>
            ) : (
              active.title
            )}
          </h2>
          {active.meta ? <p className="mt-1.5 font-sans text-small text-meta">{active.meta}</p> : null}
        </div>
      ) : null}

      {count > 1 ? (
        <ol className="absolute right-4 bottom-4 z-[3] flex gap-1.5 md:right-6 md:bottom-6" aria-label="Slides">
          {slides.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                className="flex h-6 items-center px-0.5"
              >
                <span
                  className={`block h-[2px] w-6 transition-colors md:w-8 ${i === index ? "bg-accent" : "bg-white/70"}`}
                />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
