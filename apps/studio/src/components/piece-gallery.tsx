"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

export type GalleryImage = {
  id: string;
  /** The display master (up to 4096 px); loaded only once the hero is zoomed. */
  url: string | null;
  /** PREVIEW_WIDTH rendition for the hero at rest; falls back to the master. */
  preview?: string | null;
  /** THUMB_WIDTH rendition for the strip; falls back to the preview. */
  thumb?: string | null;
  caption: string;
};

const ZOOM = 2.6;

/**
 * Hero + thumbnail strip per the design handoff. The hero shows the full image
 * (object-contain: max height or max width within the square panel, never
 * cropped) and supports in-panel zoom: click to zoom in at the cursor, move to
 * pan, click again (or leave) to zoom out.
 */
export function PieceGallery({
  images,
  stockNumber,
  imagesMeta,
}: {
  images: GalleryImage[];
  stockNumber: string;
  imagesMeta: string;
}) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);
  // Pinch tracking (iPad): distance + scale at the start of a 2-finger gesture.
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const zoomed = scale > 1.02;
  const hero = images[heroIndex];
  const count = images.length;
  const go = (delta: number) => {
    setScale(1);
    setHeroIndex((i) => (i + delta + count) % count);
  };

  const originFromEvent = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setOrigin({
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    });
  };

  const touchDist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  return (
    <div>
      <div
        ref={frameRef}
        className="group relative aspect-square w-full overflow-hidden bg-band"
      >
        {hero?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // The preview at rest; the master only when zoomed, where its
            // detail shows (the preview stays on screen while it loads).
            src={zoomed ? hero.url : hero.preview ?? hero.url}
            alt={hero.caption}
            onClick={(e) => {
              originFromEvent(e.clientX, e.clientY);
              setScale((s) => (s > 1.02 ? 1 : ZOOM));
            }}
            onMouseMove={(e) => {
              if (zoomed) originFromEvent(e.clientX, e.clientY);
            }}
            onMouseLeave={() => setScale(1)}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                // Begin a pinch; anchor the zoom at the fingers' midpoint.
                pinch.current = { dist: touchDist(e.touches), scale };
                const [a, b] = [e.touches[0]!, e.touches[1]!];
                originFromEvent((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && pinch.current) {
                e.preventDefault();
                const ratio = touchDist(e.touches) / (pinch.current.dist || 1);
                setScale(Math.min(5, Math.max(1, pinch.current.scale * ratio)));
              } else if (zoomed && e.touches[0]) {
                // One-finger pan while zoomed.
                originFromEvent(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={(e) => {
              if (e.touches.length < 2) pinch.current = null;
              // Snap back to fit if the user pinched almost all the way out.
              setScale((s) => (s < 1.1 ? 1 : s));
            }}
            style={{
              transform: `scale(${zoomed ? scale : 1})`,
              transformOrigin: `${origin.x}% ${origin.y}%`,
              touchAction: zoomed ? "none" : "pan-y",
            }}
            className={`h-full w-full object-contain transition-transform duration-200 ease-out ${
              zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
          />
        ) : (
          <div role="img" className="jvb-hatch h-full w-full" aria-label="No image" />
        )}
        {hero ? (
          <>
            {count > 1 && !zoomed ? (
              <>
                {/* Shown on hover with a pointer, always on touch; focus
                    shows them too, so a keyboard user can find them. */}
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-rule-strong bg-[var(--jvb-header-bg)] text-ink backdrop-blur-[6px] transition-opacity hover:border-ink focus-visible:opacity-100 md:h-9 md:w-9 md:opacity-0 md:group-hover:opacity-100"
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-rule-strong bg-[var(--jvb-header-bg)] text-ink backdrop-blur-[6px] transition-opacity hover:border-ink focus-visible:opacity-100 md:h-9 md:w-9 md:opacity-0 md:group-hover:opacity-100"
                >
                  <ChevronRightIcon />
                </button>
              </>
            ) : null}
            {!zoomed ? (
              <>
                <span className="pointer-events-none absolute left-2 top-2 bg-[var(--jvb-header-bg)] px-2 py-1 text-[11px] font-medium leading-none text-ink backdrop-blur-[6px]">
                  {hero.caption}
                </span>
                <span className="tabular pointer-events-none absolute right-2 top-2 bg-[var(--jvb-header-bg)] px-2 py-1 text-[11px] leading-none text-ink backdrop-blur-[6px]">
                  {heroIndex + 1} of {images.length}
                </span>
                {hero.url ? (
                  <span className="pointer-events-none absolute bottom-2 right-2 bg-[var(--jvb-header-bg)] px-2 py-1 text-[11px] font-medium leading-none text-ink backdrop-blur-[6px] transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    Click or pinch to zoom
                  </span>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2.5 flex gap-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setScale(1);
                setHeroIndex(i);
              }}
              aria-label={`Show image ${i + 1}: ${img.caption}`}
              aria-current={i === heroIndex}
              // Square thumbnails, as the website's; the one on show carries
              // the 2px accent rule inside its edge (accent marks selection).
              className={`relative aspect-square min-w-0 max-w-[96px] flex-1 overflow-hidden bg-band ${
                i === heroIndex ? "outline outline-2 -outline-offset-2 outline-accent" : ""
              }`}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.thumb ?? img.preview ?? img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="jvb-hatch block h-full w-full" />
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-rule pt-2.5">
        <span className="text-[12px] leading-[1.4] text-meta">{imagesMeta}</span>
        <Link href={`/inventory/${encodeURIComponent(stockNumber)}/images`} className="link text-[12px]">
          Manage images
        </Link>
      </div>
    </div>
  );
}
