"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  src: string;
  alt: string;
  href: string;
  label: string | null;
  width: number;
  height: number;
}

const ADVANCE_MS = 5500;

/**
 * Full-bleed, auto-advancing hero slideshow with a cross-fade.
 * - Pauses auto-advance under prefers-reduced-motion (and drops the fade via
 *   the `motion-reduce:` variant).
 * - Keyboard operable: previous/next buttons plus ArrowLeft/ArrowRight.
 * - Pauses on hover/focus so a reader can dwell on a work.
 */
export function HeroSlideshow({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = slides.length;

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count],
  );

  // Track the reduced-motion preference.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Auto-advance, unless paused, reduced-motion, or a single slide.
  const savedGo = useRef(go);
  savedGo.current = go;
  useEffect(() => {
    if (count <= 1 || paused || reducedMotion) return;
    const id = window.setInterval(() => savedGo.current(1), ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reducedMotion]);

  if (count === 0) return null;

  const single = count === 1;

  return (
    <section
      aria-label="Featured works"
      aria-roledescription="carousel"
      className="relative isolate h-[62vh] min-h-[420px] w-full overflow-hidden bg-band sm:h-[78vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (single) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        }
      }}
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <Link
            key={slide.src}
            href={slide.href}
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
            aria-label={slide.label ?? slide.alt}
            className="absolute inset-0 opacity-0 transition-opacity duration-[1200ms] ease-in-out data-[active=true]:opacity-100 motion-reduce:transition-none"
            data-active={active}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          </Link>
        );
      })}

      {/* Bottom gradient scrim so overlaid chrome stays legible over any image. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent"
      />

      {/* Current work caption. */}
      {slides[index]?.label ? (
        <p className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-[70%] text-sm font-medium text-white drop-shadow sm:bottom-6 sm:left-6">
          {slides[index].label}
        </p>
      ) : null}

      {!single ? (
        <>
          {/* Prev / next controls. */}
          <div className="absolute inset-y-0 left-0 z-10 flex items-center">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous work"
              className="m-3 inline-flex size-10 items-center justify-center rounded-full bg-overlay text-ink-strong backdrop-blur transition-colors hover:bg-control-active"
            >
              <span aria-hidden>&larr;</span>
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 z-10 flex items-center">
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next work"
              className="m-3 inline-flex size-10 items-center justify-center rounded-full bg-overlay text-ink-strong backdrop-blur transition-colors hover:bg-control-active"
            >
              <span aria-hidden>&rarr;</span>
            </button>
          </div>

          {/* Position dots. */}
          <div className="absolute bottom-4 right-4 z-10 flex gap-1.5 sm:bottom-6 sm:right-6">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to work ${i + 1} of ${count}`}
                aria-current={i === index}
                className={`size-2 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
