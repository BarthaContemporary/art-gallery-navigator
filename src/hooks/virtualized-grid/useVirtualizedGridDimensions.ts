import { useMemo } from 'react';

interface UseVirtualizedGridDimensionsProps {
  containerWidth: number;
  itemCount: number;
  isMobile: boolean;
  minItemWidthMobile?: number;
  minItemWidthDesktop?: number;
}

interface VirtualizedGridDimensions {
  columnCount: number;
  itemWidth: number;
  itemHeight: number;
  rowCount: number;
}

export function useVirtualizedGridDimensions({
  containerWidth,
  itemCount,
  isMobile,
  minItemWidthMobile = 280, // Default from original component
  minItemWidthDesktop = 320, // Default from original component
}: UseVirtualizedGridDimensionsProps): VirtualizedGridDimensions {
  return useMemo(() => {
    if (containerWidth === 0) {
      // Fallback dimensions if container width isn't measured yet
      return { columnCount: 1, itemWidth: 300, itemHeight: 420, rowCount: 0 }; // 300 * 1.4 = 420
    }

    const minItemWidth = isMobile ? minItemWidthMobile : minItemWidthDesktop;
    const cols = Math.max(1, Math.floor(containerWidth / minItemWidth));
    const width = Math.floor(containerWidth / cols);
    // Keep original aspect ratio calculation: height is 1.4 times width
    const height = Math.floor(width * 1.4); 
    const rows = Math.ceil(itemCount / cols);

    return {
      columnCount: cols,
      itemWidth: width,
      itemHeight: height,
      rowCount: rows,
    };
  }, [containerWidth, itemCount, isMobile, minItemWidthMobile, minItemWidthDesktop]);
}
