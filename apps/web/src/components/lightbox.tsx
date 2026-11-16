"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Full-screen view of one photograph over the blurred page. Scroll or pinch
 * to zoom around the pointer, drag to pan, double-click or double-tap to
 * jump between fit and 2.5×. Esc, ✕ or a click on the ground closes it.
 * Keyboard focus moves to ✕ on opening, stays on it while open (it is the
 * layer's only control) and returns to where it was on closing.
 */
const MIN = 1;
const MAX = 5;

type Pt = { x: number; y: number };
type Size = { w: number; h: number };

/**
 * The stage is `fixed inset-0`, i.e. the viewport, and the lightbox only
 * mounts in the browser after a click, so the window's size is the stage's
 * size from the first render; the layout effect below then measures it.
 */
const viewportSize = (): Size =>
  typeof window === "undefined" ? { w: 0, h: 0 } : { w: window.innerWidth, h: window.innerHeight };

export function Lightbox({
  src,
  sizes,
  largeSrc,
  alt,
  width,
  height,
  onClose,
}: {
  /** The picture already on the page, shown at once. */
  src: string;
  /** The sizes the page rendered `src` with, so the browser reuses the rendition it already holds. */
  sizes?: string;
  /** A larger rendition for zooming, swapped in once it has loaded. */
  largeSrc?: string;
  alt: string;
  width: number;
  height: number;
  onClose: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // The stage's size, kept in state so the photograph is fitted on the very
  // first painted frame and refitted when the window resizes or the phone
  // turns (a ref read during render is still null on the first render).
  const [view, setView] = useState<Size>(viewportSize);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () =>
      setView((v) => (v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The large file arrives in the background; until then the page's picture
  // stands in, so opening is instant and zooming sharpens a moment later.
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (!largeSrc) return;
    let live = true;
    const img = new window.Image();
    img.onload = () => {
      if (live) setShown(largeSrc);
    };
    img.src = largeSrc;
    return () => {
      live = false;
      // Closing early drops the download rather than letting it run on unseen.
      img.onload = null;
      img.src = "";
    };
  }, [largeSrc]);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ dist: number; scale: number; mid: Pt; pos: Pt } | null>(null);
  const drag = useRef<{ start: Pt; pos: Pt; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  // A drag that ends over the ground must not count as a "click to close".
  const suppressClick = useRef(false);
  const [closing, setClosing] = useState(false);

  /** Fade the layer out, then hand back to the parent. */
  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  // Fit-to-screen size of the photograph, so zoom maths stay in one space.
  const fit = useCallback((): Size => {
    if (view.w <= 0 || view.h <= 0) return { w: width, h: height };
    const pad = 48;
    const r = Math.max(0, Math.min((view.w - pad) / width, (view.h - pad) / height, 1));
    return { w: width * r, h: height * r };
  }, [width, height, view]);

  const clamp = useCallback(
    (p: Pt, s: number): Pt => {
      if (view.w <= 0 || view.h <= 0) return p;
      const { w, h } = fit();
      const maxX = Math.max(0, (w * s - view.w) / 2);
      const maxY = Math.max(0, (h * s - view.h) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
    },
    [fit, view],
  );

  // A new stage size (resize, rotation) can leave the pan out of bounds;
  // zooming and panning already clamp, so for them this changes nothing.
  useEffect(() => {
    setPos((p) => {
      const c = clamp(p, scale);
      return c.x === p.x && c.y === p.y ? p : c;
    });
  }, [clamp, scale]);

  // Focus: onto ✕ on opening, back to the opener (the picture's button) on closing.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  /** Zoom to `next` keeping the point under `at` (stage-centre coordinates) still. */
  const zoomAt = useCallback(
    (next: number, at: Pt) => {
      const s = Math.min(MAX, Math.max(MIN, next));
      setPos((p) => {
        const k = s / scale;
        return clamp({ x: at.x - (at.x - p.x) * k, y: at.y - (at.y - p.y) * k }, s);
      });
      setScale(s);
    },
    [scale, clamp],
  );

  const centreOf = (e: { clientX: number; clientY: number }): Pt => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      // ✕ is the layer's only control: Tab and Shift+Tab keep focus on it
      // rather than walking through the page hidden behind.
      if (e.key === "Tab") {
        e.preventDefault();
        closeButton.current?.focus({ preventScroll: true });
        return;
      }
      // Ctrl/Cmd +/- is the browser's own zoom; leave it alone. Shift is
      // not checked: "+" is Shift+= on UK and US keyboards.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomAt(scale * 1.25, { x: 0, y: 0 });
      if (e.key === "-") zoomAt(scale / 1.25, { x: 0, y: 0 });
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [close, scale, zoomAt]);

  const onWheel = (e: React.WheelEvent) => {
    // The page behind is scroll-locked, so no preventDefault is needed here.
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomAt(scale * factor, centreOf(e));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        mid: centreOf({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }),
        pos,
      };
      drag.current = null;
    } else if (pointers.current.size === 1) {
      drag.current = { start: { x: e.clientX, y: e.clientY }, pos, moved: false };
      setDragging(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const s = Math.min(MAX, Math.max(MIN, (pinch.current.scale * dist) / pinch.current.dist));
      const k = s / pinch.current.scale;
      const m = pinch.current.mid;
      setScale(s);
      setPos(clamp({ x: m.x - (m.x - pinch.current.pos.x) * k, y: m.y - (m.y - pinch.current.pos.y) * k }, s));
    } else if (drag.current && pointers.current.size === 1) {
      const dx = e.clientX - drag.current.start.x;
      const dy = e.clientY - drag.current.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      if (scale > 1) setPos(clamp({ x: drag.current.pos.x + dx, y: drag.current.pos.y + dy }, scale));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      const wasTap = drag.current && !drag.current.moved;
      suppressClick.current = !wasTap;
      drag.current = null;
      if (wasTap) {
        const now = Date.now();
        if (now - lastTap.current < 320) {
          // double tap / double click: jump between fit and 2.5×
          zoomAt(scale > 1.2 ? 1 : 2.5, centreOf(e));
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
    }
  };

  const { w, h } = fit();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={`lightbox fixed inset-0 z-[60] bg-white/55 backdrop-blur-xl ${closing ? "lightbox-closing" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !suppressClick.current) close();
        suppressClick.current = false;
      }}
    >
      <button
        ref={closeButton}
        type="button"
        onClick={close}
        aria-label="Close"
        className="fixed top-4 right-4 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center font-sans text-[22px] leading-none text-ink hover:text-accent"
      >
        ✕
      </button>
      <div className="tabular fixed bottom-4 left-1/2 z-10 -translate-x-1/2 font-sans text-small text-meta">
        {scale > 1.02 ? `${Math.round(scale * 100)}%` : "Scroll or pinch to zoom · double-click for 2.5×"}
      </div>
      <div
        ref={stage}
        className={`absolute inset-0 touch-none select-none overflow-hidden ${scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget && !suppressClick.current) close();
          suppressClick.current = false;
        }}
      >
        <Image
          src={shown}
          alt={alt}
          width={width}
          height={height}
          // The page's picture comes through the optimiser exactly as the
          // page fetched it, so it is on screen at once; the large rendition
          // is served straight from the CDN, so zooming reaches the master's
          // own pixels rather than a screen-sized copy.
          sizes={shown === src ? sizes : undefined}
          unoptimized={shown !== src}
          priority
          draggable={false}
          className="lightbox-img absolute top-1/2 left-1/2"
          style={{
            width: w,
            height: h,
            // Never painted at the master's own pixel size before the stage is known.
            visibility: view.w > 0 && view.h > 0 ? undefined : "hidden",
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
            transition: dragging || pinch.current ? "none" : "transform 220ms var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
