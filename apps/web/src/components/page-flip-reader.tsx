"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { imageDimensions, imageUrl, type SanityImage } from "@/lib/sanity";

const FLIP_MS = 650;

/**
 * Embedded page-flip reader (handoff 2f). Each Sanity spread is one
 * two-page opening; the outgoing spread's right (or left) half turns on the
 * spine to reveal the next. Arrows, ← → keys, swipe, "Fullscreen ⤢" and a
 * spread counter. Reduced motion swaps spreads without the turn.
 */
export function PageFlipReader({ spreads, title }: { spreads: SanityImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<{ from: number; dir: 1 | -1 } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const count = spreads.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= count) return i;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce) setTurn({ from: i, dir });
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    if (!turn) return;
    const t = setTimeout(() => setTurn(null), FLIP_MS);
    return () => clearTimeout(t);
  }, [turn]);

  useEffect(() => {
    setCanFullscreen(typeof document !== "undefined" && !!document.documentElement.requestFullscreen);
    const onChange = () => setFullscreen(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
      className={`outline-none ${fullscreen ? "flex h-full w-full flex-col items-center justify-center bg-overlay p-6" : ""}`}
      tabIndex={0}
      aria-roledescription="page reader"
      aria-label={`${title} — spread ${index + 1} of ${count}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
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
      <div
        className={`relative w-full overflow-hidden bg-field ${fullscreen ? "max-h-[calc(100vh-120px)]" : ""}`}
        style={{ aspectRatio: String(ratio), perspective: "2400px" }}
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
              style={{ [turn.dir === 1 ? "left" : "right"]: 0, width: "50%", animation: `reader-fade ${FLIP_MS}ms ease-in forwards` }}
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

      <div className="mt-3 flex w-full items-center justify-between font-sans text-ui">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous spread" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink hover:text-accent disabled:text-light">
            ←
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === count - 1} aria-label="Next spread" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink hover:text-accent disabled:text-light">
            →
          </button>
        </div>
        <span className="font-sans text-meta text-meta" aria-live="polite">
          {index + 1} / {count}
        </span>
        {canFullscreen ? (
          <button
            type="button"
            className="link-accent min-h-[44px]"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void wrap.current?.requestFullscreen();
            }}
          >
            {fullscreen ? "Exit fullscreen ⤡" : "Fullscreen ⤢"}
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function spreadSrc(img: SanityImage | undefined): string | null {
  return imageUrl(img, { width: 2000, quality: 82 });
}
