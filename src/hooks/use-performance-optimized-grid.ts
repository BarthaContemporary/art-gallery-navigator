/**
 * Performance optimized grid hook
 * Handles virtualization, preloading, and memory management
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizedGridDimensions } from '@/hooks/virtualized-grid/useVirtualizedGridDimensions';
import { useVisibleRange } from '@/hooks/virtualized-grid/useVisibleRange';
import { useContainerWidth } from '@/hooks/virtualized-grid/useContainerWidth';
import { useGroupedAndSortedArtworks } from '@/hooks/virtualized-grid/useGroupedAndSortedArtworks';
import { useIsMobile } from '@/hooks/use-mobile';
import { PerformanceMonitor } from '@/utils/performance';
import type { Artwork } from '@/types/artwork';

interface UsePerformanceOptimizedGridProps {
  artworks: Artwork[];
  artists: any[];
  containerId: string;
  containerHeight: number;
  scrollTop: number;
}

export function usePerformanceOptimizedGrid({
  artworks,
  artists,
  containerId,
  containerHeight,
  scrollTop,
}: UsePerformanceOptimizedGridProps) {
  const containerWidth = useContainerWidth(containerId);
  const isMobile = useIsMobile();
  const renderCountRef = useRef(0);

  // Group and sort artworks with performance monitoring
  const flattenedArtworks = PerformanceMonitor.measure('groupAndSortedArtworks', () =>
    useGroupedAndSortedArtworks(artworks, artists)
  );

  // Calculate grid dimensions
  const gridDimensions = useVirtualizedGridDimensions({
    containerWidth,
    itemCount: flattenedArtworks.length,
    isMobile,
    minItemWidthMobile: 280,
    minItemWidthDesktop: 320,
  });

  // Calculate visible range
  const visibleRange = useVisibleRange({
    scrollTop,
    itemHeight: gridDimensions.itemHeight,
    containerHeight,
    rowCount: gridDimensions.rowCount,
    columnCount: gridDimensions.columnCount,
    itemCount: flattenedArtworks.length,
  });

  // Get visible artworks with memoization
  const visibleArtworks = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      return [];
    }

    renderCountRef.current++;
    console.log(`Grid render #${renderCountRef.current}: showing items ${startIndex}-${endIndex}`);
    
    return flattenedArtworks.slice(startIndex, endIndex + 1).map((artwork, index) => ({
      artwork,
      absoluteIndex: startIndex + index,
      row: Math.floor((startIndex + index) / gridDimensions.columnCount),
      col: (startIndex + index) % gridDimensions.columnCount,
    }));
  }, [flattenedArtworks, visibleRange, gridDimensions.columnCount]);

  // Calculate positions for visible items
  const getItemPosition = useCallback((row: number, col: number) => ({
    left: col * gridDimensions.itemWidth,
    top: row * gridDimensions.itemHeight,
    width: gridDimensions.itemWidth,
    height: gridDimensions.itemHeight,
  }), [gridDimensions]);

  // Performance monitoring
  useEffect(() => {
    const metrics = {
      totalArtworks: flattenedArtworks.length,
      visibleArtworks: visibleArtworks.length,
      containerWidth,
      gridDimensions,
      visibleRange,
    };
    
    console.log('Grid Performance Metrics:', metrics);
  }, [flattenedArtworks.length, visibleArtworks.length, containerWidth, gridDimensions, visibleRange]);

  return {
    gridDimensions,
    visibleArtworks,
    getItemPosition,
    totalHeight: gridDimensions.rowCount * gridDimensions.itemHeight,
    isReady: containerWidth > 0 && flattenedArtworks.length > 0,
  };
}