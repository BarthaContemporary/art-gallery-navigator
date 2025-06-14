
import React, { useMemo, useState, useCallback, useRef, memo } from "react";
import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists, type Artist } from "@/hooks/useArtists"; // Ensure Artist type is exported or available
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useContainerWidth,
  useVirtualizedGridDimensions,
  useGroupedAndSortedArtworks,
  useVisibleRange,
} from "@/hooks/virtualized-grid"; // Ensure this path is correct

interface VirtualizedArtworkGridProps {
  artworks: Artwork[];
  containerHeight: number;
  onScrollToTop?: () => void; // Prop kept, though not used in this version
}

const VIRTUALIZED_GRID_CONTAINER_ID = "virtualized-grid-container";

function VirtualizedArtworkGridComponent({ 
  artworks, 
  containerHeight,
  // onScrollToTop // Kept for API compatibility
}: VirtualizedArtworkGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  const isMobile = useIsMobile();
  const { data: artists } = useArtists(); // Artists data
  
  // Hook to get container width
  const containerWidth = useContainerWidth(VIRTUALIZED_GRID_CONTAINER_ID);

  // Memoized valid artworks (kept from original, as it's a direct prop processing)
  const validArtworks = useMemo(() => {
    if (!Array.isArray(artworks)) {
      console.warn('Artworks is not an array:', artworks);
      return [];
    }
    return artworks.filter(artwork => {
      if (!artwork || typeof artwork !== 'object' || !artwork.id || !artwork.title) {
        // console.warn('Invalid artwork found and filtered:', artwork); // Reduce console noise for common case
        return false;
      }
      return true;
    });
  }, [artworks]);

  // Hook for grouped and sorted artworks
  const flattenedArtworks = useGroupedAndSortedArtworks(validArtworks, artists);

  // Hook for grid dimensions
  const { columnCount, itemWidth, itemHeight, rowCount } = useVirtualizedGridDimensions({
    containerWidth,
    itemCount: flattenedArtworks.length,
    isMobile,
  });

  // Hook for visible range
  const { startIndex, endIndex } = useVisibleRange({
    scrollTop,
    itemHeight,
    containerHeight,
    rowCount,
    columnCount,
    itemCount: flattenedArtworks.length,
  });

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  if (containerWidth === 0 && validArtworks.length > 0) { // Show measuring only if there are artworks
    return (
      <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full">
        <div className="text-center py-8 text-muted-foreground">Measuring container...</div>
      </div>
    );
  }

  if (!validArtworks.length) {
    return (
      <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full">
        <div className="text-center py-8 text-muted-foreground">No valid artworks to display</div>
      </div>
    );
  }
  
  if (flattenedArtworks.length === 0 && validArtworks.length > 0) {
     // This case might happen if artists data is not yet loaded for sorting
    return (
      <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full">
        <div className="text-center py-8 text-muted-foreground">Processing artworks...</div>
      </div>
    );
  }


  const totalHeight = rowCount * itemHeight;

  return (
    // Ensure the outer div has the ID for useContainerWidth if not already present in parent
    <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full"> 
      <div
        ref={scrollElementRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Render only visible items */}
          {flattenedArtworks.slice(startIndex, endIndex + 1).map((artwork, i) => {
            const actualIndex = startIndex + i;
            // This check should ideally be redundant due to slice, but good for safety
            if (!artwork || !artwork.id) return null; 
            
            const row = Math.floor(actualIndex / columnCount);
            const col = actualIndex % columnCount;
            
            return (
              <div
                key={`${artwork.id}-${actualIndex}`} // Use actualIndex for key uniqueness if IDs repeat
                className="absolute p-3" // Padding as in original
                style={{
                  left: col * itemWidth,
                  top: row * itemHeight,
                  width: itemWidth,
                  height: itemHeight,
                }}
              >
                {/* Adjust inner div for padding as in original */}
                <div style={{ width: itemWidth - 24, height: itemHeight - 24 }}> 
                  <ArtworkCard artwork={artwork} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const VirtualizedArtworkGrid = memo(VirtualizedArtworkGridComponent);
