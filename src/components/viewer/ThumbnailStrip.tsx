/**
 * Optimized Thumbnail Strip for Viewer
 * Mobile-optimized with larger touch targets and swipe navigation
 */

import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ViewerImageOptimizer } from '@/services/viewer/image-optimizer';
import type { ViewerArtworkImage } from '@/types/viewer';

interface ThumbnailStripProps {
  images: ViewerArtworkImage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  visible: boolean;
}

interface ThumbnailProps {
  image: ViewerArtworkImage;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

const Thumbnail = memo(function Thumbnail({ image, isActive, onClick, index }: ThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [src, setSrc] = useState<string>('/placeholder.svg');

  useEffect(() => {
    const thumbnailUrl = ViewerImageOptimizer.getOptimizedUrl(image, 'thumbnail');
    const fallbackUrl = ViewerImageOptimizer.getBestAvailableUrl(image);
    
    setSrc(thumbnailUrl);

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.onerror = () => {
      setSrc(fallbackUrl);
      const fallbackImg = new Image();
      fallbackImg.onload = () => setIsLoaded(true);
      fallbackImg.src = fallbackUrl;
    };
    img.src = thumbnailUrl;
  }, [image]);

  return (
    <button
      onClick={onClick}
      className={cn(
        // Larger touch targets on mobile (56x56), smaller on desktop (48x48)
        "flex-shrink-0 w-14 h-14 sm:w-12 sm:h-12 rounded overflow-hidden transition-all",
        "ring-2 ring-offset-2 ring-offset-transparent",
        // Active state feedback
        isActive
          ? "ring-white scale-105"
          : "ring-transparent hover:ring-white/50 active:scale-95"
      )}
      aria-label={`View image ${index + 1}`}
      style={{
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <img
        src={src}
        alt=""
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-40"
        )}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </button>
  );
});

function ThumbnailStripComponent({ images, activeIndex, onSelect, visible }: ThumbnailStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const scrollStart = useRef(0);

  // Auto-scroll to keep active thumbnail visible
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const thumbnailWidth = window.innerWidth < 640 ? 56 : 48; // Match CSS sizes
      const gap = 8;
      const targetScroll = activeIndex * (thumbnailWidth + gap) - container.clientWidth / 2 + thumbnailWidth / 2;
      
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  // Swipe handlers for navigating between images
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    scrollStart.current = containerRef.current?.scrollLeft || 0;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;

    // Detect fast horizontal swipe (not just scroll)
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 2;
    const isQuickSwipe = deltaTime < 300 && Math.abs(deltaX) > 50;

    if (isHorizontalSwipe && isQuickSwipe) {
      if (deltaX < 0 && activeIndex < images.length - 1) {
        // Swipe left → next image
        onSelect(activeIndex + 1);
      } else if (deltaX > 0 && activeIndex > 0) {
        // Swipe right → previous image
        onSelect(activeIndex - 1);
      }
    }

    touchStart.current = null;
  }, [activeIndex, images.length, onSelect]);

  if (images.length <= 1) return null;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute bottom-20 sm:bottom-20 left-1/2 -translate-x-1/2 max-w-[90vw]",
        "backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg",
        // Larger padding on mobile for easier touch
        "p-2.5 sm:p-2 flex gap-2 overflow-x-auto transition-opacity duration-300",
        // Hide scrollbar but keep functionality
        "scrollbar-none",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{
        // Smooth scroll momentum on iOS
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((img, idx) => (
        <Thumbnail
          key={img.id}
          image={img}
          isActive={idx === activeIndex}
          onClick={() => onSelect(idx)}
          index={idx}
        />
      ))}
    </div>
  );
}

export const ThumbnailStrip = memo(ThumbnailStripComponent);
