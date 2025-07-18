/**
 * Phase 4: Artwork Preloader Hook
 * 
 * Intelligent preloading for next images in grid and performance optimization.
 */

import { useEffect, useRef, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ImageUrlResolver, ImageTier } from "@/services/image-url-resolver";

interface UseArtworkPreloaderOptions {
  artworks: Artwork[];
  currentIndex?: number;
  preloadCount?: number;
  preloadTier?: ImageTier;
  enabled?: boolean;
}

export function useArtworkPreloader({
  artworks,
  currentIndex = 0,
  preloadCount = 3,
  preloadTier = 'thumbnail',
  enabled = true
}: UseArtworkPreloaderOptions) {
  const preloadQueueRef = useRef<Set<string>>(new Set());
  const preloadInProgressRef = useRef<Set<string>>(new Set());

  const preloadArtwork = useCallback(async (artwork: Artwork) => {
    const key = `${artwork.id}-${preloadTier}`;
    
    // Skip if already preloaded or in progress
    if (preloadQueueRef.current.has(key) || preloadInProgressRef.current.has(key)) {
      return;
    }

    preloadInProgressRef.current.add(key);

    try {
      const resolvedUrl = await ImageUrlResolver.resolveImageUrl(
        artwork,
        preloadTier,
        false
      );

      if (resolvedUrl.source !== 'placeholder') {
        await ImageUrlResolver.preloadImage(resolvedUrl.url);
        preloadQueueRef.current.add(key);
      }
    } catch (error) {
      console.debug(`Preload failed for artwork ${artwork.id}:`, error);
    } finally {
      preloadInProgressRef.current.delete(key);
    }
  }, [preloadTier]);

  // Preload upcoming artworks based on current index
  useEffect(() => {
    if (!enabled || artworks.length === 0) return;

    const preloadNext = async () => {
      const startIndex = Math.max(0, currentIndex);
      const endIndex = Math.min(artworks.length, startIndex + preloadCount);
      
      const preloadPromises = [];
      
      for (let i = startIndex; i < endIndex; i++) {
        const artwork = artworks[i];
        if (artwork) {
          preloadPromises.push(preloadArtwork(artwork));
        }
      }

      await Promise.allSettled(preloadPromises);
    };

    // Debounce preloading to avoid excessive requests
    const timeoutId = setTimeout(preloadNext, 100);
    
    return () => clearTimeout(timeoutId);
  }, [artworks, currentIndex, preloadCount, enabled, preloadArtwork]);

  // Intersection Observer for visible artwork preloading
  const observeArtwork = useCallback((element: HTMLElement, artwork: Artwork) => {
    if (!enabled || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            preloadArtwork(artwork);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start preloading 50px before element is visible
        threshold: 0.1
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled, preloadArtwork]);

  // Clear cache
  const clearPreloadCache = useCallback(() => {
    preloadQueueRef.current.clear();
    preloadInProgressRef.current.clear();
    ImageUrlResolver.clearCache();
  }, []);

  return {
    preloadArtwork,
    observeArtwork,
    clearPreloadCache,
    preloadedCount: preloadQueueRef.current.size,
    isPreloading: preloadInProgressRef.current.size > 0
  };
}