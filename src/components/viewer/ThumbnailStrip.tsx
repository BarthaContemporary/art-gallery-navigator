/**
 * Optimized Thumbnail Strip for Viewer
 * Uses lazy loading and optimized thumbnails
 */

import { memo, useEffect, useState } from 'react';
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
    // Use optimized thumbnail URL with fallback to original
    const thumbnailUrl = ViewerImageOptimizer.getOptimizedUrl(image, 'thumbnail');
    const fallbackUrl = ViewerImageOptimizer.getBestAvailableUrl(image);
    
    setSrc(thumbnailUrl);

    // Preload the thumbnail with fallback
    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.onerror = () => {
      // Fall back to original if transformation fails
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
        "flex-shrink-0 w-12 h-12 rounded overflow-hidden transition-all",
        "ring-2 ring-offset-2 ring-offset-transparent",
        isActive
          ? "ring-white"
          : "ring-transparent hover:ring-white/50"
      )}
      aria-label={`View image ${index + 1}`}
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
      />
    </button>
  );
});

function ThumbnailStripComponent({ images, activeIndex, onSelect, visible }: ThumbnailStripProps) {
  if (images.length <= 1) return null;

  return (
    <div className={cn(
      "absolute bottom-20 left-1/2 -translate-x-1/2 max-w-[90vw]",
      "backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg",
      "p-2 flex gap-2 overflow-x-auto transition-opacity duration-300",
      visible ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
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
