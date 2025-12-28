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

type LoadStage = 'placeholder' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'loaded';

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
    return ViewerImageOptimizer.generateSrcSet(image);
  }, [image]);

  // Sizes attribute for responsive images
  const sizes = useMemo(() => {
    return '100vw'; // Full viewport width for viewer
  }, []);

  // Determine which tier to load based on zoom level
  const getTargetTier = useCallback((currentZoom: number): ImageTier => {
    if (currentZoom >= 6) return 'xxlarge';
    if (currentZoom >= 4) return 'xlarge';
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

  // Initial load sequence - simplified since transformations are disabled
  useEffect(() => {
    if (!image) return;

    let isMounted = true;
    setLoadStage('placeholder');
    setBlurAmount(10);

    const loadSequence = async () => {
      const imageUrl = ViewerImageOptimizer.getBestAvailableUrl(image);
      
      try {
        // Set src immediately
        if (isMounted) {
          setCurrentSrc(imageUrl);
        }

        // Preload the image
        await ViewerImageOptimizer.preloadImage(imageUrl);
        
        if (isMounted) {
          setBlurAmount(0);
          setLoadStage('loaded');
          onLoad?.();
        }
      } catch (error) {
        console.warn('Image load error:', error);
        if (isMounted) {
          setCurrentSrc(imageUrl);
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
    const tierOrder = ['small', 'medium', 'large', 'xlarge', 'xxlarge'];
    const currentIndex = tierOrder.indexOf(loadStage);
    const targetIndex = tierOrder.indexOf(targetTier);
    const shouldUpgrade = targetIndex > currentIndex && currentIndex !== -1;

    if (!shouldUpgrade) return;

    const upgradeImage = async () => {
      try {
        const url = await loadTier(targetTier);
        if (isMounted) {
          setCurrentSrc(url);
          setLoadStage(targetTier as LoadStage);
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
        "object-contain",
        isTransitioning && "transition-all duration-300",
        className
      )}
      style={{
        ...style,
        filter: blurAmount > 0 ? `blur(${blurAmount}px)` : undefined,
        transform: style?.transform,
        width: '100%',
        height: '100%',
      }}
      draggable={draggable}
      decoding="async"
      fetchPriority="high"
    />
  );
}

export const ProgressiveImage = memo(ProgressiveImageComponent);
