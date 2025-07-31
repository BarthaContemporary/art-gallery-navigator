
import React, { useMemo, useState, useCallback, useRef, memo } from "react";
import { ArtworkCard } from "./ArtworkCard";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists, type Artist } from "@/hooks/useArtists";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useContainerWidth,
  useVirtualizedGridDimensions,
  useGroupedAndSortedArtworks,
  useVisibleRange,
} from "@/hooks/virtualized-grid";

// Container ID for measuring and virtualizing, with consistent spacing
const GRID_GAP = 8; // 8px gap between items (equivalent to gap-2 in Tailwind)

interface VirtualizedArtworkGridProps {
  artworks: Artwork[];
  containerHeight: number;
  onScrollToTop?: () => void;
}

const VIRTUALIZED_GRID_CONTAINER_ID = "virtualized-grid-container";

function VirtualizedArtworkGridComponent({ 
  artworks, 
  containerHeight,
}: VirtualizedArtworkGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  const isMobile = useIsMobile();
  const { data: artists } = useArtists();

  const containerWidth = useContainerWidth(VIRTUALIZED_GRID_CONTAINER_ID);

  const validArtworks = useMemo(() => {
    if (!Array.isArray(artworks)) {
      console.warn('Artworks is not an array:', artworks);
      return [];
    }
    return artworks.filter(artwork => {
      if (!artwork || typeof artwork !== 'object' || !artwork.id || !artwork.title) {
        return false;
      }
      return true;
    });
  }, [artworks]);

  const flattenedArtworks = useGroupedAndSortedArtworks(validArtworks, artists);

  // Use fixed itemHeight
  const { columnCount, itemWidth, itemHeight, rowCount } = useVirtualizedGridDimensions({
    containerWidth,
    itemCount: flattenedArtworks.length,
    isMobile,
  });

  const { startIndex, endIndex } = useVisibleRange({
    scrollTop,
    itemHeight, // this is now the fixed card height
    containerHeight,
    rowCount,
    columnCount,
    itemCount: flattenedArtworks.length,
  });

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  if (containerWidth === 0 && validArtworks.length > 0) {
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
    return (
      <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full">
        <div className="text-center py-8 text-muted-foreground">Processing artworks...</div>
      </div>
    );
  }

  // Use a larger vertical padding to ensure no overlap (12px top, 12px bottom → p-3 for 24px total spacing)
  const totalHeight = rowCount * itemHeight;

  return (
    <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full"> 
      <div
        ref={scrollElementRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {flattenedArtworks.slice(startIndex, endIndex + 1).map((artwork, i) => {
            const actualIndex = startIndex + i;
            if (!artwork || !artwork.id) return null; 
            
            const row = Math.floor(actualIndex / columnCount);
            const col = actualIndex % columnCount;
            
            return (
              <div
                key={`${artwork.id}-${actualIndex}`}
                className="absolute p-3"
                style={{
                  left: col * itemWidth,
                  top: row * itemHeight,
                  width: itemWidth,
                  height: itemHeight,
                }}
              >
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
