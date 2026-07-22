"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export type GalleryImage = {
  id: string;
  url: string | null;
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
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);

  const hero = images[heroIndex];
  const count = images.length;
  const go = (delta: number) => {
    setZoomed(false);
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

  return (
    <div>
      <div
        ref={frameRef}
        className="group relative aspect-square w-full overflow-hidden rounded-[12px] bg-band"
      >
        {hero?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.url}
            alt={hero.caption}
            onClick={(e) => {
              originFromEvent(e.clientX, e.clientY);
              setZoomed((z) => !z);
            }}
            onMouseMove={(e) => {
              if (zoomed) originFromEvent(e.clientX, e.clientY);
            }}
            onMouseLeave={() => setZoomed(false)}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (zoomed && t) originFromEvent(t.clientX, t.clientY);
            }}
            style={{
              transform: zoomed ? `scale(${ZOOM})` : "scale(1)",
              transformOrigin: `${origin.x}% ${origin.y}%`,
            }}
            className={`h-full w-full object-contain transition-transform duration-200 ease-out ${
              zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
          />
        ) : (
          <div className="jvb-hatch h-full w-full" aria-label="No image" />
        )}
        {hero ? (
          <>
            {count > 1 && !zoomed ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-control bg-[var(--jvb-bg-overlay)] text-ink-body backdrop-blur-[6px] transition-opacity md:opacity-0 md:group-hover:opacity-100"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-control bg-[var(--jvb-bg-overlay)] text-ink-body backdrop-blur-[6px] transition-opacity md:opacity-0 md:group-hover:opacity-100"
                >
                  ›
                </button>
              </>
            ) : null}
            {!zoomed ? (
              <>
                <span className="pointer-events-none absolute left-3 top-3 rounded-lg bg-[var(--jvb-bg-overlay)] px-2.5 py-1 text-[11px] font-medium text-ink-body backdrop-blur-[6px]">
                  {hero.caption}
                </span>
                <span className="pointer-events-none absolute right-3 top-3 rounded-lg bg-[var(--jvb-bg-overlay)] px-2.5 py-1 font-mono text-[10.5px] text-ink-body backdrop-blur-[6px]">
                  {heroIndex + 1} / {images.length}
                </span>
                {hero.url ? (
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-[var(--jvb-bg-overlay)] px-2.5 py-1 text-[11px] font-medium text-ink-body backdrop-blur-[6px] transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    ⚲ Click to zoom
                  </span>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2.5 flex gap-[9px]">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setZoomed(false);
                setHeroIndex(i);
              }}
              aria-label={`Show image ${i + 1}: ${img.caption}`}
              aria-current={i === heroIndex}
              className={`relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg transition-shadow duration-150 ${
                i === heroIndex
                  ? "shadow-[inset_0_0_0_2px_var(--jvb-border-ring)]"
                  : ""
              }`}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt=""
                  className={`h-full w-full object-cover ${i === heroIndex ? "opacity-90" : ""}`}
                />
              ) : (
                <span className="jvb-hatch block h-full w-full" />
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3">
        <span className="text-[12px] text-ink-soft">{imagesMeta}</span>
        <Link
          href={`/inventory/${encodeURIComponent(stockNumber)}/images`}
          className="text-[12px] font-medium text-[var(--jvb-ink-desc)]"
        >
          Manage images
        </Link>
      </div>
    </div>
  );
}
