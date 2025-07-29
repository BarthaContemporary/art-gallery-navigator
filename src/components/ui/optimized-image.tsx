import React, { useState, useCallback, memo } from 'react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { ImageOptimizer } from '@/utils/performance-monitor';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  lazy?: boolean;
}

const OptimizedImageComponent = ({
  src,
  alt,
  className = '',
  width,
  height,
  placeholder = '/placeholder.svg',
  onLoad,
  onError,
  lazy = true,
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string>('');

  const { ref, isVisible } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  // Load image when visible or lazy loading is disabled
  React.useEffect(() => {
    if ((!lazy || isVisible) && src && !loadedSrc && !hasError) {
      // Check if image is already cached
      if (ImageOptimizer.isImageLoaded(src)) {
        setLoadedSrc(src);
        setIsLoading(false);
        return;
      }

      // Preload image
      ImageOptimizer.preloadImage(src).then((success) => {
        if (success) {
          setLoadedSrc(src);
        } else {
          setHasError(true);
          setIsLoading(false);
        }
      });
    }
  }, [lazy, isVisible, src, loadedSrc, hasError]);

  const imageProps = {
    alt,
    className: `${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`,
    onLoad: handleLoad,
    onError: handleError,
    loading: lazy ? ('lazy' as const) : undefined,
    ...(width && { width }),
    ...(height && { height }),
  };

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="relative">
      {hasError ? (
        <img {...imageProps} src={placeholder} />
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-muted/30 animate-pulse" />
          )}
          {loadedSrc && (
            <img {...imageProps} src={loadedSrc} />
          )}
        </>
      )}
    </div>
  );
};

export const OptimizedImage = memo(OptimizedImageComponent);