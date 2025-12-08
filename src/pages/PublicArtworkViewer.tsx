import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewerArtworkBySlug } from '@/hooks/viewer/useViewerArtworks';
import { ProgressiveImage } from '@/components/viewer/ProgressiveImage';
import { ThumbnailStrip } from '@/components/viewer/ThumbnailStrip';
import { ViewerImageOptimizer } from '@/services/viewer/image-optimizer';

export default function PublicArtworkViewer() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { data: artwork, isLoading, error } = useViewerArtworkBySlug(slug);

  // Settings from URL params - default to fill mode for fullscreen
  const initialMode = searchParams.get('initial') === 'fit' ? 'fit' : 'fill';
  const forceDark = searchParams.get('dark') === 'true';

  // State
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<'fit' | 'fill'>(initialMode);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPan = useRef({ x: 0, y: 0 });
  const hideTimeout = useRef<NodeJS.Timeout>();

  const activeImage = artwork?.images?.[activeIndex];
  const images = artwork?.images || [];

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
        if (!isDragging) setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      clearTimeout(hideTimeout.current);
    };
  }, [isDragging]);

  // Reset zoom/pan/mode when image changes - always start fullscreen
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setMode('fill');
  }, [activeIndex]);

  // Preload next image using optimized URL
  useEffect(() => {
    if (images.length > 1) {
      const nextIndex = (activeIndex + 1) % images.length;
      const nextImage = images[nextIndex];
      // Preload small version first for quick thumbnail, then medium
      ViewerImageOptimizer.preloadImage(
        ViewerImageOptimizer.getOptimizedUrl(nextImage, 'small')
      ).then(() => {
        ViewerImageOptimizer.preloadImage(
          ViewerImageOptimizer.getOptimizedUrl(nextImage, 'medium')
        );
      }).catch(() => {
        // Silently handle preload errors
      });
    }
  }, [activeIndex, images]);

  // Zoom handlers
  const handleZoom = useCallback((delta: number, clientX?: number, clientY?: number) => {
    setZoom((prev) => {
      const newZoom = Math.max(0.5, Math.min(10, prev + delta));
      
      // Adjust pan to zoom toward cursor if provided
      if (clientX !== undefined && clientY !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = (clientX - rect.left - centerX) / prev;
        const offsetY = (clientY - rect.top - centerY) / prev;
        
        setPan((p) => ({
          x: p.x - offsetX * delta,
          y: p.y - offsetY * delta,
        }));
      }
      
      return newZoom;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    handleZoom(delta, e.clientX, e.clientY);
  }, [handleZoom]);

  // Pan handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1 && mode === 'fit') return;
    
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastPan.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [zoom, mode, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setPan({
      x: lastPan.current.x + (e.clientX - dragStart.current.x) / zoom,
      y: lastPan.current.y + (e.clientY - dragStart.current.y) / zoom,
    });
  }, [isDragging, zoom]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Double-click to zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      handleZoom(1.5, e.clientX, e.clientY);
    }
  }, [zoom, handleZoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        "fixed inset-0 flex items-center justify-center",
        forceDark ? "bg-black" : "bg-neutral-200"
      )}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !artwork) {
    return (
      <div className={cn(
        "fixed inset-0 flex items-center justify-center",
        forceDark ? "bg-black text-white" : "bg-neutral-200"
      )}>
        <div className="text-center">
          <h1 className="text-xl font-medium mb-2">Artwork not found</h1>
          <p className="text-muted-foreground">The requested artwork could not be loaded.</p>
        </div>
      </div>
    );
  }

  // No images
  if (!activeImage) {
    return (
      <div className={cn(
        "fixed inset-0 flex items-center justify-center",
        forceDark ? "bg-black text-white" : "bg-neutral-200"
      )}>
        <div className="text-center">
          <h1 className="text-xl font-medium mb-2">{artwork.title}</h1>
          <p className="text-muted-foreground">No images available for this artwork.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 overflow-hidden select-none",
        forceDark ? "bg-black" : "bg-neutral-200",
        isDragging ? "cursor-grabbing" : zoom > 1 ? "cursor-grab" : "cursor-default"
      )}
      onWheel={handleWheel}
    >
      {/* Main Image with Progressive Loading */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <ProgressiveImage
          image={activeImage}
          alt={activeImage.alt_text || artwork.title}
          zoom={zoom}
          className={cn(
            "transition-transform duration-100",
            mode === 'fit' ? "max-h-full max-w-full object-contain" : "min-h-full min-w-full object-cover"
          )}
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Controls - Inverted dark background for legibility */}
      <div className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2",
        "backdrop-blur-xl bg-black/80 border border-white/10 rounded-full",
        "px-3 py-2 flex items-center gap-1.5 transition-opacity duration-300 shadow-lg",
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <button
          onClick={() => handleZoom(-0.5)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4 text-white" />
        </button>
        
        <span className="text-xs text-white font-medium min-w-[3rem] text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        
        <button
          onClick={() => handleZoom(0.5)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4 text-white" />
        </button>
        
        <div className="w-px h-6 bg-white/30" />
        
        <button
          onClick={resetView}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4 text-white" />
        </button>
        
        <button
          onClick={() => setMode(mode === 'fit' ? 'fill' : 'fit')}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          title={mode === 'fit' ? 'Fill screen' : 'Fit to screen'}
        >
          {mode === 'fit' ? (
            <Maximize2 className="h-4 w-4 text-white" />
          ) : (
            <Minimize2 className="h-4 w-4 text-white" />
          )}
        </button>
      </div>

      {/* Optimized Thumbnail Strip */}
      <ThumbnailStrip
        images={images}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        visible={showControls}
      />
    </div>
  );
}
