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
 * 16:9 hero slideshow (handoff 2a/2b). Crossfade every ~6.5s, swipe on
 * touch, ← → on the keyboard. Markers are short bars bottom-right, the
 * active one orange, after a pause / play button. Caption sits bottom-left
 * on a translucent white block.
 *
 * It always moves on by itself. It used to stop while the pointer rested
 * anywhere on it, and an event page's banner fills the top of the screen,
 * so it seldom moved at all; and it never moved for a visitor whose device
 * asks for reduced motion. Now it stops only when asked to: the pause
 * button, or keyboard focus inside it (the arrow keys then step through).
 * Reduced motion keeps the pace but swaps the pictures with no fade.
 */
export function HeroSlideshow({
  slides,
  priority = true,
  caption = true,
  intervalMs = INTERVAL_MS,
  fadeMs = 900,
  label = "Current and forthcoming events",
}: {
  slides: Slide[];
  priority?: boolean;
  /** Set false on event pages where the text block below carries the title. */
  caption?: boolean;
  /** Time each slide holds; event banners use a slower pace than the home page. */
  intervalMs?: number;
  /** Crossfade length. */
  fadeMs?: number;
  label?: string;
}) {
  const [index, setIndex] = useState(0);
  // Stopped with the pause button, until play; held while keyboard focus is
  // inside (a pointer's click on a marker takes focus too, but no pause).
  const [stopped, setStopped] = useState(false);
  const [focusHeld, setFocusHeld] = useState(false);
  const paused = stopped || focusHeld;
  // Each time it runs again the marker's fill starts over with the timer.
  const [runs, setRuns] = useState(0);
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) setRuns((n) => n + 1);
    wasPaused.current = paused;
  }, [paused]);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)),
    [count],
  );

  // One timer per slide, so a slide picked from the markers gets its full
  // time before the next.
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setTimeout(() => go(1), intervalMs);
    return () => clearTimeout(t);
  }, [count, paused, go, intervalMs, index, runs]);

  if (count === 0) return null;
  const active = slides[Math.min(index, count - 1)] ?? slides[0]!;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative w-full"
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) setFocusHeld(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusHeld(false);
      }}
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
      <div className="relative w-full overflow-hidden bg-field" style={{ aspectRatio: String(RATIO.hero) }}>
      {slides.map((s, i) => (
        <div
          key={s.key}
          className="slide"
          style={{ transitionDuration: reduceMotion ? "0ms" : `${fadeMs}ms` }}
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

      {count > 1 ? (
        <div className="absolute right-4 bottom-4 z-[3] flex items-center gap-1.5 md:right-6 md:bottom-6">
          <button
            type="button"
            onClick={() => setStopped((v) => !v)}
            aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
            aria-pressed={stopped}
            className="slide-toggle"
          >
            {stopped ? <PlayGlyph /> : <PauseGlyph />}
          </button>
          <ol className="flex gap-1.5" aria-label="Slides">
            {slides.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show slide ${i + 1}`}
                  aria-current={i === index}
                  className="flex h-6 items-center px-0.5"
                >
                  <span className={`relative block h-[2px] w-6 overflow-hidden md:w-8 ${i === index && (count < 2 || reduceMotion) ? "bg-accent" : "bg-white/70"}`}>
                    {i === index && count > 1 && !reduceMotion ? (
                      // The fill crosses the bar in exactly one interval, restarting per slide.
                      <span
                        key={`${index}:${runs}`}
                        className="marker-fill absolute inset-0 bg-accent"
                        data-paused={paused}
                        style={{ "--slide-ms": `${intervalMs}ms` } as React.CSSProperties}
                      />
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      </div>

      {/* The caption overlays the picture from md up; on a phone the 16:9
          frame is only a few hundred pixels tall, so it sits beneath the
          image instead, at a smaller size, and the picture stays clear. */}
      {caption ? (
        <div className="pointer-events-none z-[2] max-w-[min(520px,92%)] px-4 pt-3 md:absolute md:bottom-6 md:left-6 md:bg-white/85 md:px-7 md:py-6 md:backdrop-blur-[2px]">
          <p className="eyebrow">{active.eyebrow}</p>
          <h2 className="mt-1 font-sans text-[16px] font-light leading-tight text-ink md:mt-1.5 md:text-[22px]">
            {active.href ? (
              <Link href={active.href} className="pointer-events-auto hover:text-accent">
                {active.title}
              </Link>
            ) : (
              active.title
            )}
          </h2>
          {active.meta ? (
            <p className="mt-1 whitespace-pre-line font-sans text-[12px] text-meta md:mt-1.5 md:text-small">{active.meta}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Two upright bars at the markers' weight. */
function PauseGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2.5" y="1.5" width="2" height="9" />
      <rect x="7.5" y="1.5" width="2" height="9" />
    </svg>
  );
}

/** A right-pointing triangle, the same size. */
function PlayGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 1.5v9l7.5-4.5z" />
    </svg>
  );
}
