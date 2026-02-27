import { useEffect, useMemo, useRef, useState } from "react";
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

const OVERLAP_FRACTION = 0.24;
const BASE_WIDTH_VW = 72;

const getCandidates = (img: StripImage) =>
  [img.large_url, img.medium_url, img.thumbnail_url, img.original_url]
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .filter((u, i, arr) => arr.indexOf(u) === i);

export function ImmersiveStripViewer({ images, className }: ImmersiveStripViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPanRafRef = useRef<number>(0);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPan, setIsAutoPan] = useState(false);
  const [urlIndexes, setUrlIndexes] = useState<Record<string, number>>({});

  const resolvedImages = useMemo(
    () =>
      images.map((img) => {
        const candidates = getCandidates(img);
        const activeIndex = Math.min(urlIndexes[img.id] ?? 0, Math.max(0, candidates.length - 1));
        return {
          id: img.id,
          candidates,
          src: candidates[activeIndex] || "",
          hasFallback: activeIndex < candidates.length - 1,
        };
      }),
    [images, urlIndexes]
  );

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const maxScroll = Math.max(1, el.scrollWidth - el.clientWidth);
      setProgress(Math.min(1, Math.max(0, el.scrollLeft / maxScroll)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [zoom, images.length]);

  useEffect(() => {
    if (!isAutoPan) {
      cancelAnimationFrame(autoPanRafRef.current);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const animate = () => {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (el.scrollLeft >= maxScroll) {
        setIsAutoPan(false);
        return;
      }
      el.scrollLeft += 0.8;
      autoPanRafRef.current = requestAnimationFrame(animate);
    };

    autoPanRafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(autoPanRafRef.current);
  }, [isAutoPan]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleImageError = (id: string) => {
    setUrlIndexes((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const imageWidthVw = BASE_WIDTH_VW * zoom;
  const overlapMargin = `calc(-${imageWidthVw * OVERLAP_FRACTION}vw)`;

  if (!images.length) return null;

  return (
    <div className={`relative bg-black ${className || "flex-1"}`}>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x proximity",
        }}
      >
        <div className="h-full flex items-center px-[8vw]">
          {resolvedImages.map((img, idx) => (
            <div
              key={img.id}
              className="relative h-full flex-shrink-0"
              style={{
                width: `${imageWidthVw}vw`,
                marginLeft: idx > 0 ? overlapMargin : undefined,
                zIndex: images.length - idx,
                scrollSnapAlign: "center",
              }}
            >
              <img
                src={img.src}
                alt={`Immersive photo ${idx + 1}`}
                loading="lazy"
                draggable={false}
                onError={() => img.hasFallback && handleImageError(img.id)}
                className="h-full w-full object-cover pointer-events-none"
                style={{
                  WebkitMaskImage:
                    idx === 0
                      ? "linear-gradient(to right, black 0%, black 78%, transparent 100%)"
                      : idx === resolvedImages.length - 1
                        ? "linear-gradient(to right, transparent 0%, black 22%, black 100%)"
                        : "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
                  maskImage:
                    idx === 0
                      ? "linear-gradient(to right, black 0%, black 78%, transparent 100%)"
                      : idx === resolvedImages.length - 1
                        ? "linear-gradient(to right, transparent 0%, black 22%, black 100%)"
                        : "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-52 md:w-72">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 rounded-full transition-all duration-100" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-center text-[10px] text-white/50 mt-1">{images.length} photos • drag to move</p>
      </div>

      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setIsAutoPan((v) => !v)}
        >
          {isAutoPan ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setZoom((z) => Math.max(0.75, z / 1.15))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setZoom((z) => Math.min(1.8, z * 1.15))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
