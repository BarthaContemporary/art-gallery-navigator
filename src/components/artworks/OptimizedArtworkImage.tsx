
import { useState, useRef, useEffect } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Loader2 } from "lucide-react";
import { useOptimizedImage } from "@/hooks/use-optimized-image";
import { cn } from "@/lib/utils";

interface OptimizedArtworkImageProps {
  imageUrl: string | null;
  title: string;
  onClick?: () => void;
  priority?: boolean;
  className?: string;
  sizes?: {
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

const defaultSizes = {
  thumbnail: { width: 400, height: 300, quality: 80 },
  medium: { width: 1200, height: 1200, quality: 100 },
  full: { width: 2400, height: 2400, quality: 100 }
};

export function OptimizedArtworkImage({ 
  imageUrl, 
  title, 
  onClick, 
  priority = false,
  className,
  sizes = defaultSizes
}: OptimizedArtworkImageProps) {
  const [isInView, setIsInView] = useState(priority);
  const [hasInteracted, setHasInteracted] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  const {
    currentImageUrl,
    currentTier,
    isLoading,
    error,
    blurDataUrl,
    upgradeToTier,
    canUpgrade
  } = useOptimizedImage({
    originalUrl: imageUrl || "/placeholder.svg",
    alt: title,
    sizes
  });

  // Intersection Observer for lazy loading and prefetching
  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Immediately start loading medium quality for better UX
            if (canUpgrade.toMedium) {
              setTimeout(() => upgradeToTier('medium'), 50);
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '200px' } // Increased rootMargin for earlier prefetching
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => observer.disconnect();
  }, [priority, canUpgrade.toMedium, upgradeToTier]);

  const handleInteraction = () => {
    setHasInteracted(true);
    if (currentTier === 'thumbnail' && canUpgrade.toMedium) {
      upgradeToTier('medium');
    } else if (currentTier === 'medium' && canUpgrade.toFull) {
      upgradeToTier('full');
    }
    onClick?.();
  };

  const handleMouseEnter = () => {
    if (!hasInteracted && currentTier === 'thumbnail' && canUpgrade.toMedium) {
      upgradeToTier('medium');
    }
  };

  if (!isInView && !priority) {
    return (
      <div 
        ref={imageRef}
        className={cn("aspect-[4/3] w-full bg-muted/30 flex items-center justify-center", className)}
      >
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div 
      ref={imageRef}
      className={cn(
        "aspect-[4/3] w-full overflow-hidden cursor-pointer relative group bg-muted/30",
        className
      )}
      onClick={handleInteraction}
      onMouseEnter={handleMouseEnter}
    >
      <AspectRatio ratio={4/3}>
        {/* Blur placeholder */}
        {blurDataUrl && isLoading && (
          <img 
            src={blurDataUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover blur-sm scale-110 transition-opacity duration-300"
            aria-hidden="true"
            style={{ filter: 'blur(8px)' }}
          />
        )}

        {/* Loading indicator */}
        {isLoading && !blurDataUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Main image */}
        <img
          src={currentImageUrl}
          alt={title}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-all duration-500",
            isLoading ? 'opacity-0' : 'opacity-100',
            currentTier === 'medium' && 'scale-[1.01]',
            currentTier === 'full' && 'scale-[1.02]'
          )}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />

        {/* Quality indicator */}
        {currentTier !== 'thumbnail' && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
              {currentTier === 'medium' ? 'HD' : currentTier === 'full' ? 'Ultra HD' : ''}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="text-red-500 text-sm text-center">
              Failed to load image
            </div>
          </div>
        )}
      </AspectRatio>
    </div>
  );
}
