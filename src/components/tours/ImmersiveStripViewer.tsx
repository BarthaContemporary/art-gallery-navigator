import { useState, useRef, useEffect, useCallback } from "react";
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

export function ImmersiveStripViewer({ images, className }: ImmersiveStripViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const autoPanRef = useRef<number>(0);

  const [offsetX, setOffsetX] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [autoPan, setAutoPan] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Drag state refs for performance
  const dragState = useRef({
    startX: 0,
    startOffset: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  });

  const getStripWidth = useCallback(() => {
    if (!stripRef.current) return 0;
    return stripRef.current.scrollWidth * zoom;
  }, [zoom]);

  const getContainerWidth = useCallback(() => {
    return containerRef.current?.clientWidth || 0;
  }, []);

  const clampOffset = useCallback((x: number) => {
    const containerW = getContainerWidth();
    const stripW = images.length * containerW * 0.6 * zoom; // approximate
    const minX = Math.min(0, containerW - stripW);
    return Math.max(minX, Math.min(0, x));
  }, [images.length, zoom, getContainerWidth]);

  // Progress (0..1)
  const progress = (() => {
    const containerW = getContainerWidth();
    const stripW = images.length * containerW * 0.6 * zoom;
    const maxScroll = Math.max(1, stripW - containerW);
    return Math.min(1, Math.max(0, -offsetX / maxScroll));
  })();

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (autoPan) setAutoPan(false);
    setIsDragging(true);
    dragState.current = {
      startX: e.clientX,
      startOffset: offsetX,
      lastX: e.clientX,
      lastTime: Date.now(),
      velocityX: 0,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offsetX, autoPan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const now = Date.now();
    const dt = now - dragState.current.lastTime;
    const dx = e.clientX - dragState.current.lastX;
    if (dt > 0) {
      dragState.current.velocityX = dx / dt * 16; // px per frame
    }
    dragState.current.lastX = e.clientX;
    dragState.current.lastTime = now;

    const totalDx = e.clientX - dragState.current.startX;
    setOffsetX(clampOffset(dragState.current.startOffset + totalDx));
  }, [isDragging, clampOffset]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Momentum
    let velocity = dragState.current.velocityX;
    const decay = 0.95;
    let currentOffset = offsetX;

    const animate = () => {
      velocity *= decay;
      if (Math.abs(velocity) < 0.5) return;
      currentOffset += velocity;
      currentOffset = clampOffset(currentOffset);
      setOffsetX(currentOffset);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [isDragging, offsetX, clampOffset]);

  // Auto-pan
  useEffect(() => {
    if (!autoPan) {
      cancelAnimationFrame(autoPanRef.current);
      return;
    }
    let current = offsetX;
    const speed = -0.5; // px per frame

    const animate = () => {
      current += speed;
      current = clampOffset(current);
      setOffsetX(current);
      
      // Stop at end
      const containerW = getContainerWidth();
      const stripW = images.length * containerW * 0.6 * zoom;
      if (-current >= stripW - containerW) {
        setAutoPan(false);
        return;
      }
      autoPanRef.current = requestAnimationFrame(animate);
    };
    autoPanRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(autoPanRef.current);
  }, [autoPan, clampOffset, images.length, zoom, getContainerWidth]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(autoPanRef.current);
    };
  }, []);

  // Zoom
  const handleZoomIn = () => setZoom((z) => Math.min(3, z * 1.3));
  const handleZoomOut = () => {
    setZoom((z) => {
      const newZ = Math.max(0.5, z / 1.3);
      return newZ;
    });
  };

  // Recalculate offset on zoom change
  useEffect(() => {
    setOffsetX((prev) => clampOffset(prev));
  }, [zoom, clampOffset]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Track loaded images for lazy loading  
  const handleImageLoad = (id: string) => {
    setLoadedImages((prev) => new Set(prev).add(id));
  };

  if (images.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-black select-none touch-none ${className || "flex-1"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Image strip */}
      <div
        ref={stripRef}
        className="flex items-center h-full will-change-transform"
        style={{
          transform: `translateX(${offsetX}px) scale(${zoom})`,
          transformOrigin: "left center",
          transition: isDragging ? "none" : undefined,
        }}
      >
        {images.map((img, idx) => {
          const url = img.large_url || img.medium_url || img.original_url;
          return (
            <div
              key={img.id}
              className="relative flex-shrink-0 h-full"
              style={{ width: "60vw" }}
            >
              {/* Crossfade edges */}
              {idx > 0 && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-16 z-10"
                  style={{
                    background: "linear-gradient(to right, rgba(0,0,0,0.6), transparent)",
                  }}
                />
              )}
              {idx < images.length - 1 && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-16 z-10"
                  style={{
                    background: "linear-gradient(to left, rgba(0,0,0,0.6), transparent)",
                  }}
                />
              )}
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className="h-full w-full object-cover pointer-events-none"
                draggable={false}
                loading="lazy"
                onLoad={() => handleImageLoad(img.id)}
              />
              {!loadedImages.has(img.id) && (
                <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
                  <span className="text-white/30 text-sm">{idx + 1}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-48 md:w-64">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-center text-[10px] text-white/40 mt-1">
          {images.length} photos • Drag to explore
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); setAutoPan(!autoPan); }}
        >
          {autoPan ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
