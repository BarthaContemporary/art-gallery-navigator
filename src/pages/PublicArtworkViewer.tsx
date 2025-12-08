/**
 * Public Artwork Viewer
 * Mobile-optimized with pinch-to-zoom, momentum panning, double-tap zoom
 * Designed for iPhone and iPad with proper touch handling
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewerArtworkBySlug } from '@/hooks/viewer/useViewerArtworks';
import { ProgressiveImage } from '@/components/viewer/ProgressiveImage';
import { ThumbnailStrip } from '@/components/viewer/ThumbnailStrip';
import { ViewerImageOptimizer } from '@/services/viewer/image-optimizer';
import { useViewerGestures } from '@/hooks/viewer/useViewerGestures';

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
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<NodeJS.Timeout>();

  // Use gesture hook for touch handling
  const {
    bind,
    scale,
    position,
    isGesturing,
    resetView,
    zoomIn,
    zoomOut,
    handleTap,
  } = useViewerGestures({
    minZoom: 0.5,
    maxZoom: 10,
    doubleTapZoom: 2.5,
  });

  const activeImage = artwork?.images?.[activeIndex];
  const images = artwork?.images || [];

  // Auto-hide controls with longer timeout for touch devices
  useEffect(() => {
    const handleInteraction = () => {
      setShowControls(true);
      clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
        if (!isGesturing) setShowControls(false);
      }, 4000); // Longer timeout for touch devices
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('touchmove', handleInteraction, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('touchmove', handleInteraction);
      clearTimeout(hideTimeout.current);
    };
  }, [isGesturing]);

  // Reset zoom/pan/mode when image changes - always start fullscreen
  useEffect(() => {
    resetView();
    setMode('fill');
  }, [activeIndex, resetView]);

  // Preload next image using optimized URL
  useEffect(() => {
    if (images.length > 1) {
      const nextIndex = (activeIndex + 1) % images.length;
      const nextImage = images[nextIndex];
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
        isGesturing ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-default"
      )}
      style={{
        // iOS-specific touch handling
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none',
      } as React.CSSProperties}
    >
      {/* Main Image with Gesture Handling */}
      <div
        {...bind()}
        className="absolute inset-0 flex items-center justify-center"
        onPointerDown={handleTap}
        style={{
          touchAction: 'none',
        }}
      >
        <ProgressiveImage
          image={activeImage}
          alt={activeImage.alt_text || artwork.title}
          zoom={scale}
          className={cn(
            "transition-transform duration-75 will-change-transform",
            mode === 'fit' ? "max-h-full max-w-full object-contain" : "min-h-full min-w-full object-cover"
          )}
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      </div>

      {/* Controls - Mobile-optimized with larger touch targets */}
      <div className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2",
        "backdrop-blur-xl bg-black/80 border border-white/10 rounded-full",
        "px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-1.5 transition-opacity duration-300 shadow-lg",
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <button
          onClick={zoomOut}
          className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-5 w-5 sm:h-4 sm:w-4 text-white" />
        </button>
        
        <span className="text-xs text-white font-medium min-w-[3rem] text-center tabular-nums hidden sm:block">
          {Math.round(scale * 100)}%
        </span>
        
        <button
          onClick={zoomIn}
          className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-5 w-5 sm:h-4 sm:w-4 text-white" />
        </button>
        
        <div className="w-px h-6 bg-white/30 hidden sm:block" />
        
        <button
          onClick={resetView}
          className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          title="Reset view"
          aria-label="Reset view"
        >
          <RotateCcw className="h-5 w-5 sm:h-4 sm:w-4 text-white" />
        </button>
        
        <button
          onClick={() => setMode(mode === 'fit' ? 'fill' : 'fit')}
          className="p-2.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          title={mode === 'fit' ? 'Fill screen' : 'Fit to screen'}
          aria-label={mode === 'fit' ? 'Fill screen' : 'Fit to screen'}
        >
          {mode === 'fit' ? (
            <Maximize2 className="h-5 w-5 sm:h-4 sm:w-4 text-white" />
          ) : (
            <Minimize2 className="h-5 w-5 sm:h-4 sm:w-4 text-white" />
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
