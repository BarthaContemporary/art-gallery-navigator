
import { useMemo } from 'react';

interface UseVisibleRangeProps {
  scrollTop: number;
  itemHeight: number;
  containerHeight: number;
  rowCount: number;
  columnCount: number;
  itemCount: number; 
}

interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

export function useVisibleRange({
  scrollTop,
  itemHeight,
  containerHeight,
  rowCount,
  columnCount,
  itemCount,
}: UseVisibleRangeProps): VisibleRange {
  return useMemo(() => {
    if (itemHeight <= 0 || containerHeight <= 0 || itemCount === 0) {
      return { startIndex: 0, endIndex: -1 }; // No items to display or invalid dimensions
    }

    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight));
    const endRow = Math.min(
      rowCount - 1, 
      Math.max(0, Math.ceil((scrollTop + containerHeight) / itemHeight) -1) // -1 because row indices are 0-based
    );                                                                 // and ceil gives count

    const startIndex = Math.max(0, startRow * columnCount);
    const endIndex = Math.min(
      itemCount - 1, 
      (endRow + 1) * columnCount - 1
    );
    
    // Ensure endIndex is not less than startIndex
    if (endIndex < startIndex) {
        // This can happen with very small containerHeight or rapid scrolling.
        // Default to showing a small batch from startIndex or just the start item.
        return { startIndex, endIndex: Math.min(startIndex + columnCount -1, itemCount -1) };
    }

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, rowCount, columnCount, itemCount]);
}
