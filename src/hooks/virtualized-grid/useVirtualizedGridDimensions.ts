
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

// Card height calculation: Square image (dynamic based on width) + Info section (~170px) + padding
// For consistent spacing, we'll calculate height dynamically based on width
const calculateCardHeight = (width: number): number => {
  const imageHeight = width; // Square aspect ratio
  const infoSectionHeight = 170; // Approximate height of the info section
  const padding = 32; // Vertical padding
  return imageHeight + infoSectionHeight + padding;
};

export function useVirtualizedGridDimensions({
  containerWidth,
  itemCount,
  isMobile,
  minItemWidthMobile = 280,
  minItemWidthDesktop = 320,
}: UseVirtualizedGridDimensionsProps): VirtualizedGridDimensions {
  return useMemo(() => {
    if (containerWidth === 0) {
      // Fallback dimensions if container width isn't measured yet
      const fallbackWidth = 300;
      return { 
        columnCount: 1, 
        itemWidth: fallbackWidth, 
        itemHeight: calculateCardHeight(fallbackWidth), 
        rowCount: 0 
      };
    }

    const minItemWidth = isMobile ? minItemWidthMobile : minItemWidthDesktop;
    const cols = Math.max(1, Math.floor(containerWidth / minItemWidth));
    const width = Math.floor(containerWidth / cols);

    // Calculate height based on square image + info section
    const height = calculateCardHeight(width);
    const rows = Math.ceil(itemCount / cols);

    return {
      columnCount: cols,
      itemWidth: width,
      itemHeight: height,
      rowCount: rows,
    };
  }, [containerWidth, itemCount, isMobile, minItemWidthMobile, minItemWidthDesktop]);
}
