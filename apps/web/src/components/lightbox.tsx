"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Full-screen view of one photograph on white. Opens from the fold-out
 * panel's image; Esc, ✕ or a click on the ground closes it. A click on the
 * photograph toggles between "fit" and actual pixels (scroll to pan). Uses
 * the Fullscreen API where the browser has it, so the browser chrome goes
 * too; on iPhone it is a fixed layer instead.
 */
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
  const [zoom, setZoom] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const el = wrap.current;
    let usedFullscreen = false;
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    if (el?.requestFullscreen) {
      el.requestFullscreen().then(() => {
        usedFullscreen = true;
        document.addEventListener("fullscreenchange", onFs);
      }).catch(() => {});
    }
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (usedFullscreen && document.fullscreenElement) void document.exitFullscreen();
    };
  }, [onClose]);

  return (
    <div
      ref={wrap}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={`lightbox fixed inset-0 z-[60] bg-page ${zoom ? "overflow-auto" : "overflow-hidden"}`}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed top-4 right-4 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center font-sans text-[22px] leading-none text-ink hover:text-accent"
      >
        ✕
      </button>
      <div className={zoom ? "flex min-h-full min-w-full items-start justify-start p-0" : "flex h-full w-full items-center justify-center p-6 md:p-10"}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="100vw"
          quality={85}
          priority
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => !z);
          }}
          className={`lightbox-img select-none ${zoom ? "h-auto max-w-none cursor-zoom-out" : "h-auto max-h-full w-auto max-w-full cursor-zoom-in object-contain"}`}
          style={zoom ? { width: Math.min(width, 2400) } : undefined}
          draggable={false}
        />
      </div>
    </div>
  );
}
