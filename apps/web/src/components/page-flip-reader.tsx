"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { imageDimensions, imageUrl, type SanityImage } from "@/lib/sanity";

const FLIP_MS = 420;

/**
 * Embedded page-flip reader (handoff 2f). Each Sanity spread is one
 * two-page opening; the outgoing spread's right (or left) half turns on the
 * spine to reveal the next. Arrows, ← → keys anywhere on the page, swipe, a
 * "Fullscreen ⤢" view over the blurred page (like the image zoom) and a
 * spread counter. Reduced motion swaps spreads without the turn.
 */
export function PageFlipReader({ spreads, title }: { spreads: SanityImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<{ from: number; dir: 1 | -1 } | null>(null);
  const turnRef = useRef<{ from: number; dir: 1 | -1 } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const count = spreads.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= count) return i;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // One turn at a time: a press mid-turn jumps, it does not restart.
        if (!reduce && !turnRef.current) setTurn({ from: i, dir });
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    turnRef.current = turn;
    if (!turn) return;
    const t = setTimeout(() => setTurn(null), FLIP_MS);
    return () => clearTimeout(t);
  }, [turn]);

  // Arrow keys turn pages from anywhere on the page (not while typing);
  // Esc leaves the full-screen view, which also locks the page scroll.
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape" && fullscreen) {
        e.preventDefault();
        setFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Preload the neighbours so a turn never waits on the network.
  useEffect(() => {
    for (const i of [index + 1, index - 1]) {
      const src = spreadSrc(spreads[i]);
      if (src) new Image().src = src;
    }
  }, [index, spreads]);

  if (count === 0) return null;
  const current = spreads[index]!;
  const dims = imageDimensions(current);
  const ratio = dims ? dims.width / dims.height : 3 / 2;
  const outgoing = turn ? spreads[turn.from] : null;

  return (
    <div
      ref={wrap}
      className={
        fullscreen
          ? "lightbox fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/55 p-6 backdrop-blur-xl md:p-10"
          : "outline-none"
      }
      aria-roledescription="page reader"
      aria-label={`${title} — spread ${index + 1} of ${count}`}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const s = touchX.current;
        const x = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (s === null || x === undefined) return;
        if (s - x > 40) go(1);
        else if (x - s > 40) go(-1);
      }}
    >
      {fullscreen ? (
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          aria-label="Close full screen"
          className="fixed top-4 right-4 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center font-sans text-[22px] leading-none text-ink hover:text-accent"
        >
          ✕
        </button>
      ) : null}
      <div
        className="relative w-full overflow-hidden bg-field"
        style={
          fullscreen
            ? { aspectRatio: String(ratio), perspective: "2400px", width: `min(100%, calc((100vh - 140px) * ${ratio}))` }
            : { aspectRatio: String(ratio), perspective: "2400px" }
        }
      >
        {/* incoming / resting spread */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current._key ?? index}
          src={spreadSrc(current) ?? ""}
          alt={current.caption ?? `${title} — spread ${index + 1}`}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
        {outgoing && turn ? (
          <>
            {/* the half that stays put fades as the page lifts */}
            <div
              className="reader-half absolute inset-y-0"
              style={{ [turn.dir === 1 ? "left" : "right"]: 0, width: "50%", animation: `reader-fade ${FLIP_MS}ms var(--ease-out) forwards` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={spreadSrc(outgoing) ?? ""} alt="" className="absolute inset-y-0 h-full w-[200%] max-w-none object-contain" style={{ [turn.dir === 1 ? "left" : "right"]: 0 }} draggable={false} />
            </div>
            {/* the turning half — rotates on the spine, backface hidden */}
            <div
              className="reader-half absolute inset-y-0"
              style={{
                [turn.dir === 1 ? "right" : "left"]: 0,
                width: "50%",
                transformOrigin: turn.dir === 1 ? "left center" : "right center",
                backfaceVisibility: "hidden",
                animation: `${turn.dir === 1 ? "reader-turn-fwd" : "reader-turn-back"} ${FLIP_MS}ms ease-in-out forwards`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={spreadSrc(outgoing) ?? ""} alt="" className="absolute inset-y-0 h-full w-[200%] max-w-none object-contain" style={{ [turn.dir === 1 ? "right" : "left"]: 0 }} draggable={false} />
            </div>
          </>
        ) : null}
      </div>

      <div
        className="mt-3 flex items-center justify-between font-sans text-ui"
        style={fullscreen ? { width: `min(100%, calc((100vh - 140px) * ${ratio}))` } : { width: "100%" }}
      >
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous spread" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink hover:text-accent disabled:text-light">
            ←
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === count - 1} aria-label="Next spread" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink hover:text-accent disabled:text-light">
            →
          </button>
        </div>
        <span className="tabular font-sans text-small text-meta" aria-live="polite">
          {index + 1} / {count}
        </span>
        <button type="button" className="link-accent min-h-[44px]" onClick={() => setFullscreen((f) => !f)}>
          {fullscreen ? "Exit fullscreen ⤡" : "Fullscreen ⤢"}
        </button>
      </div>
    </div>
  );
}

function spreadSrc(img: SanityImage | undefined): string | null {
  return imageUrl(img, { width: 2000, quality: 82 });
}
