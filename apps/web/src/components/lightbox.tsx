"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-screen view of one photograph over the blurred page. Scroll or pinch
 * to zoom around the pointer, drag to pan, double-click or double-tap to
 * jump between fit and 2.5×. Esc, ✕ or a click on the ground closes it.
 */
const MIN = 1;
const MAX = 5;

type Pt = { x: number; y: number };

export function Lightbox({
  src,
  alt,
  width,
  height,
  onClose,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  onClose: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
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
  const fit = useCallback(() => {
    const el = stage.current;
    if (!el) return { w: width, h: height };
    const pad = 48;
    const r = Math.min((el.clientWidth - pad) / width, (el.clientHeight - pad) / height, 1);
    return { w: width * r, h: height * r };
  }, [width, height]);

  const clamp = useCallback(
    (p: Pt, s: number): Pt => {
      const el = stage.current;
      if (!el) return p;
      const { w, h } = fit();
      const maxX = Math.max(0, (w * s - el.clientWidth) / 2);
      const maxY = Math.max(0, (h * s - el.clientHeight) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
    },
    [fit],
  );

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
      }
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
      className={`lightbox fixed inset-0 z-[60] bg-white/55 backdrop-blur-2xl ${closing ? "lightbox-closing" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !suppressClick.current) close();
        suppressClick.current = false;
      }}
    >
      <button
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
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="100vw"
          quality={85}
          priority
          draggable={false}
          className="lightbox-img absolute top-1/2 left-1/2"
          style={{
            width: w,
            height: h,
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
            transition: dragging || pinch.current ? "none" : "transform 220ms var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
