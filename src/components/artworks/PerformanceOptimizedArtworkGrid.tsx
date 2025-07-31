/**
 * Performance Optimized Artwork Grid
 * High-performance virtualized grid with global dialog management
 */

import React, { memo, useRef, useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useArtists } from "@/hooks/useArtists";
import { usePerformanceOptimizedGrid } from "@/hooks/use-performance-optimized-grid";
import { OptimizedArtworkSelectionCard } from "./selection/OptimizedArtworkSelectionCard";
import { GlobalDialogRenderer } from "./dialogs/GlobalDialogRenderer";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Artwork } from "@/types/artwork";

const VIRTUALIZED_GRID_CONTAINER_ID = "performance-optimized-artwork-grid";

interface PerformanceOptimizedArtworkGridProps {
  artworks: Artwork[];
  containerHeight: number;
  onScrollToTop?: () => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

const PerformanceOptimizedArtworkGridComponent = ({
  artworks,
  containerHeight,
  onScrollToTop,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
}: PerformanceOptimizedArtworkGridProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Fetch artists data
  const { data: artists = [], isLoading: artistsLoading, error: artistsError } = useArtists();

  // Validate artworks
  const validArtworks = useMemo(() => {
    return artworks.filter(artwork => 
      artwork && 
      typeof artwork === 'object' && 
      artwork.id && 
      artwork.title
    );
  }, [artworks]);

  // Use performance optimized grid
  const {
    gridDimensions,
    visibleArtworks,
    getItemPosition,
    totalHeight,
    isReady,
  } = usePerformanceOptimizedGrid({
    artworks: validArtworks,
    artists,
    containerId: VIRTUALIZED_GRID_CONTAINER_ID,
    containerHeight,
    scrollTop,
  });

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  // Handle selection toggle
  const handleToggleSelection = useCallback((id: string) => {
    onToggleSelection?.(id);
  }, [onToggleSelection]);

  // Loading state
  if (artistsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="w-full aspect-square rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (artistsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Failed to load artists</h3>
            <p className="text-muted-foreground">Please try refreshing the page</p>
          </div>
          <Button onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // Container width measuring
  if (!isReady) {
    return (
      <div id={VIRTUALIZED_GRID_CONTAINER_ID} className="w-full">
        <div className="text-center py-8 text-muted-foreground">
          Measuring container...
        </div>
      </div>
    );
  }

  // Empty state
  if (validArtworks.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No artworks to display</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters or add some artworks.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        id={VIRTUALIZED_GRID_CONTAINER_ID}
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto"
        onScroll={handleScroll}
      >
        <div
          className="relative"
          style={{ height: totalHeight, contain: 'strict' }}
        >
          {visibleArtworks.map(({ artwork, absoluteIndex, row, col }) => {
            const position = getItemPosition(row, col);
            const isSelected = selectedIds.has(artwork.id);

            return (
              <div
                key={artwork.id}
                className="absolute"
                style={{
                  left: position.left,
                  top: position.top,
                  width: position.width,
                  height: position.height,
                  padding: '12px', // Consistent padding for proper spacing
                }}
              >
                <OptimizedArtworkSelectionCard
                  artwork={artwork}
                  isSelected={isSelected}
                  isSelectionMode={isSelectionMode}
                  onToggleSelection={handleToggleSelection}
                  index={absoluteIndex}
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Global dialog renderer */}
      <GlobalDialogRenderer />
    </>
  );
};

// Optimize memo comparison
const arePropsEqual = (
  prevProps: PerformanceOptimizedArtworkGridProps,
  nextProps: PerformanceOptimizedArtworkGridProps
) => {
  return (
    prevProps.artworks.length === nextProps.artworks.length &&
    prevProps.containerHeight === nextProps.containerHeight &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.selectedIds.size === nextProps.selectedIds.size &&
    // Compare artwork IDs for changes
    prevProps.artworks.every((artwork, index) => 
      artwork.id === nextProps.artworks[index]?.id &&
      artwork.updated_at === nextProps.artworks[index]?.updated_at
    )
  );
};

export const PerformanceOptimizedArtworkGrid = memo(PerformanceOptimizedArtworkGridComponent, arePropsEqual);