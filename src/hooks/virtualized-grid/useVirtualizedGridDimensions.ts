
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

// Fixed card height: Image 256px + Info 170px + vertical padding 32px = 458px
const FIXED_CARD_HEIGHT = 458;

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
      return { columnCount: 1, itemWidth: 300, itemHeight: FIXED_CARD_HEIGHT, rowCount: 0 };
    }

    const minItemWidth = isMobile ? minItemWidthMobile : minItemWidthDesktop;
    const cols = Math.max(1, Math.floor(containerWidth / minItemWidth));
    const width = Math.floor(containerWidth / cols);

    // Use FIXED_CARD_HEIGHT for all cards for consistency
    const height = FIXED_CARD_HEIGHT;
    const rows = Math.ceil(itemCount / cols);

    return {
      columnCount: cols,
      itemWidth: width,
      itemHeight: height,
      rowCount: rows,
    };
  }, [containerWidth, itemCount, isMobile, minItemWidthMobile, minItemWidthDesktop]);
}
