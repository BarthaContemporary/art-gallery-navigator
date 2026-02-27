import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";

interface StripImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  medium_url: string | null;
  large_url: string | null;
}

interface ImmersiveStripViewerProps {
  images: StripImage[];
  className?: string;
}

const getCandidates = (img: StripImage) =>
  [img.large_url, img.medium_url, img.thumbnail_url, img.original_url]
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .filter((u, i, arr) => arr.indexOf(u) === i);

export function ImmersiveStripViewer({ images, className }: ImmersiveStripViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // State
  const [offsetX, setOffsetX] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPan, setIsAutoPan] = useState(false);
  const [urlIndexes, setUrlIndexes] = useState<Record<string, number>>({});

  // Drag state refs (avoid re-renders during drag)
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startOffset: 0,
    velocity: 0,
    lastX: 0,
    lastTime: 0,
  });

  const resolvedImages = useMemo(
    () =>
      images.map((img) => {
        const candidates = getCandidates(img);
        const activeIndex = Math.min(urlIndexes[img.id] ?? 0, Math.max(0, candidates.length - 1));
        return { id: img.id, src: candidates[activeIndex] || "", hasFallback: activeIndex < candidates.length - 1 };
      }),
    [images, urlIndexes]
  );

  // Each image takes 60% of container width at zoom=1, with 20% overlap
  const getMetrics = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { imgW: 400, totalW: 400, maxOffset: 0 };
    const cw = container.clientWidth;
    const imgW = cw * 0.6 * zoom;
    const overlap = imgW * 0.2;
    const totalW = images.length > 0 ? imgW * images.length - overlap * (images.length - 1) : 0;
    const maxOffset = Math.max(0, totalW - cw);
    return { imgW, totalW, maxOffset };
  }, [images.length, zoom]);

  // Clamp offset
  const clampOffset = useCallback((x: number) => {
    const { maxOffset } = getMetrics();
    return Math.max(0, Math.min(maxOffset, x));
  }, [getMetrics]);

  // Mouse/touch drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    d.isDragging = true;
    d.startX = e.clientX;
    d.startOffset = offsetX;
    d.velocity = 0;
    d.lastX = e.clientX;
    d.lastTime = Date.now();
    setIsAutoPan(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offsetX]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.isDragging) return;
    const dx = d.startX - e.clientX;
    const now = Date.now();
    const dt = Math.max(1, now - d.lastTime);
    d.velocity = (d.lastX - e.clientX) / dt;
    d.lastX = e.clientX;
    d.lastTime = now;
    setOffsetX(clampOffset(d.startOffset + dx));
  }, [clampOffset]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    d.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Momentum
    let vel = d.velocity * 15; // px/frame
    const animate = () => {
      if (Math.abs(vel) < 0.5) return;
      vel *= 0.94;
      setOffsetX((prev) => clampOffset(prev + vel));
      rafRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [clampOffset]);

  // Auto-pan
  useEffect(() => {
    if (!isAutoPan) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      setOffsetX((prev) => {
        const { maxOffset } = getMetrics();
        const next = prev + 0.8;
        if (next >= maxOffset) { setIsAutoPan(false); return maxOffset; }
        return next;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isAutoPan, getMetrics]);

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
  };

  const handleImageError = (id: string) => {
    setUrlIndexes((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  // Progress
  const { maxOffset } = getMetrics();
  const progress = maxOffset > 0 ? offsetX / maxOffset : 0;

  if (!images.length) return null;

  const { imgW } = getMetrics();
  const overlap = imgW * 0.2;

  return (
    <div
      ref={containerRef}
      className={`relative bg-black overflow-hidden select-none ${className || "flex-1"}`}
      style={{ touchAction: "none", cursor: dragRef.current.isDragging ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Strip */}
      <div
        ref={stripRef}
        className="absolute top-0 bottom-0 flex items-center"
        style={{
          transform: `translateX(${-offsetX}px)`,
          willChange: "transform",
        }}
      >
        {resolvedImages.map((img, idx) => {
          const left = idx * (imgW - overlap);
          const isFirst = idx === 0;
          const isLast = idx === resolvedImages.length - 1;

          // Blend mask: fade edges for overlap blending
          const mask = isFirst
            ? "linear-gradient(to right, black 0%, black 80%, transparent 100%)"
            : isLast
              ? "linear-gradient(to right, transparent 0%, black 20%, black 100%)"
              : "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)";

          return (
            <div
              key={img.id}
              className="absolute top-0 bottom-0"
              style={{
                left: `${left}px`,
                width: `${imgW}px`,
                zIndex: images.length - idx,
              }}
            >
              <img
                src={img.src}
                alt={`Photo ${idx + 1}`}
                loading={idx < 3 ? "eager" : "lazy"}
                draggable={false}
                onError={() => img.hasFallback && handleImageError(img.id)}
                className="h-full w-full object-cover pointer-events-none"
                style={{
                  WebkitMaskImage: mask,
                  maskImage: mask,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-52 md:w-72 pointer-events-none">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/80 rounded-full transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-center text-[10px] text-white/50 mt-1">
          {images.length} photos • drag to explore
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setIsAutoPan((v) => !v)}>
          {isAutoPan ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
