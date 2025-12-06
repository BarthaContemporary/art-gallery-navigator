/**
 * Progressive Image Component for Viewer
 * Loads images in stages: blur placeholder -> small -> medium -> large (on zoom)
 * Includes srcset for responsive loading
 */

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ViewerImageOptimizer, type ImageTier } from '@/services/viewer/image-optimizer';
import type { ViewerArtworkImage } from '@/types/viewer';

interface ProgressiveImageProps {
  image: ViewerArtworkImage | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  zoom?: number;
  onLoad?: () => void;
  draggable?: boolean;
}

type LoadStage = 'placeholder' | 'small' | 'medium' | 'large' | 'loaded';

function ProgressiveImageComponent({
  image,
  alt,
  className,
  style,
  zoom = 1,
  onLoad,
  draggable = false,
}: ProgressiveImageProps) {
  const [loadStage, setLoadStage] = useState<LoadStage>('placeholder');
  const [currentSrc, setCurrentSrc] = useState<string>('/placeholder.svg');
  const [blurAmount, setBlurAmount] = useState(20);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Generate srcset for responsive loading
  const srcSet = useMemo(() => {
    if (!image) return undefined;
    
    const smallUrl = ViewerImageOptimizer.getOptimizedUrl(image, 'small');
    const mediumUrl = ViewerImageOptimizer.getOptimizedUrl(image, 'medium');
    const largeUrl = ViewerImageOptimizer.getOptimizedUrl(image, 'large');

    return `${smallUrl} 400w, ${mediumUrl} 1200w, ${largeUrl} 2400w`;
  }, [image]);

  // Determine sizes attribute based on zoom
  const sizes = useMemo(() => {
    if (zoom >= 2) return '2400px';
    if (zoom >= 1) return '100vw';
    return '(max-width: 768px) 100vw, 1200px';
  }, [zoom]);

  // Determine which tier to load based on zoom level
  const getTargetTier = useCallback((currentZoom: number): ImageTier => {
    if (currentZoom >= 2) return 'large';
    if (currentZoom >= 1) return 'medium';
    return 'small';
  }, []);

  // Load image at a specific tier
  const loadTier = useCallback(async (tier: ImageTier): Promise<string> => {
    const url = ViewerImageOptimizer.getOptimizedUrl(image, tier);
    await ViewerImageOptimizer.preloadImage(url);
    return url;
  }, [image]);

  // Initial load sequence: blur -> small -> medium
  useEffect(() => {
    if (!image) return;

    let isMounted = true;
    setLoadStage('placeholder');
    setBlurAmount(20);

    const loadSequence = async () => {
      try {
        // Stage 1: Load blur placeholder immediately
        const blurUrl = ViewerImageOptimizer.getBlurPlaceholderUrl(image);
        if (isMounted) {
          setCurrentSrc(blurUrl);
        }

        // Stage 2: Load small version
        const smallUrl = await loadTier('small');
        if (isMounted) {
          setIsTransitioning(true);
          setCurrentSrc(smallUrl);
          setBlurAmount(8);
          setLoadStage('small');
          setTimeout(() => setIsTransitioning(false), 300);
        }

        // Stage 3: Load medium version
        const mediumUrl = await loadTier('medium');
        if (isMounted) {
          setIsTransitioning(true);
          setCurrentSrc(mediumUrl);
          setBlurAmount(0);
          setLoadStage('medium');
          setTimeout(() => {
            setIsTransitioning(false);
            onLoad?.();
          }, 300);
        }
      } catch (error) {
        console.warn('Progressive image load error:', error);
        // Fallback to best available
        if (isMounted) {
          const fallback = ViewerImageOptimizer.getBestAvailableUrl(image);
          setCurrentSrc(fallback);
          setBlurAmount(0);
          setLoadStage('loaded');
          onLoad?.();
        }
      }
    };

    loadSequence();

    return () => {
      isMounted = false;
    };
  }, [image, loadTier, onLoad]);

  // Load larger image when zoomed in
  useEffect(() => {
    if (!image || loadStage === 'placeholder') return;

    let isMounted = true;
    const targetTier = getTargetTier(zoom);

    // Only upgrade if we need a larger image
    const shouldUpgrade =
      (targetTier === 'large' && loadStage !== 'large') ||
      (targetTier === 'medium' && loadStage === 'small');

    if (!shouldUpgrade) return;

    const upgradeImage = async () => {
      try {
        const url = await loadTier(targetTier);
        if (isMounted) {
          setCurrentSrc(url);
          setLoadStage(targetTier === 'large' ? 'large' : 'loaded');
        }
      } catch (error) {
        console.warn('Failed to upgrade image tier:', error);
      }
    };

    upgradeImage();

    return () => {
      isMounted = false;
    };
  }, [zoom, image, loadStage, getTargetTier, loadTier]);

  if (!image) {
    return (
      <div className={cn("flex items-center justify-center bg-neutral-300", className)}>
        <span className="text-muted-foreground">No image</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      srcSet={loadStage !== 'placeholder' ? srcSet : undefined}
      sizes={loadStage !== 'placeholder' ? sizes : undefined}
      alt={alt}
      className={cn(
        "max-w-none",
        isTransitioning && "transition-all duration-300",
        className
      )}
      style={{
        ...style,
        filter: blurAmount > 0 ? `blur(${blurAmount}px)` : undefined,
        transform: style?.transform,
      }}
      draggable={draggable}
      decoding="async"
      fetchPriority="high"
    />
  );
}

export const ProgressiveImage = memo(ProgressiveImageComponent);
