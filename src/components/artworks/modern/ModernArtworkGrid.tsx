/**
 * Phase 2: Modern Artwork Grid Component
 * 
 * Clean, performant grid layout with responsive design and loading states.
 */

import React, { useState, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ModernArtworkCard } from "./ModernArtworkCard";
import { FullScreenImageViewer } from "./FullScreenImageViewer";
import { Grid, List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModernArtworkGridProps {
  artworks: Artwork[];
  onEdit?: (artwork: Artwork) => void;
  onDuplicate?: (artwork: Artwork) => void;
  onExport?: (artwork: Artwork) => void;
  onDelete?: (artwork: Artwork) => void;
  onFavorite?: (artwork: Artwork) => void;
  onShare?: (artwork: Artwork) => void;
  showActions?: boolean;
  loading?: boolean;
}

type GridDensity = 'comfortable' | 'compact' | 'dense';

export function ModernArtworkGrid({ 
  artworks,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  onFavorite,
  onShare,
  showActions = true,
  loading = false
}: ModernArtworkGridProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [gridDensity, setGridDensity] = useState<GridDensity>('comfortable');

  const handleView = useCallback((artwork: Artwork) => {
    const index = artworks.findIndex(a => a.id === artwork.id);
    setSelectedIndex(index);
    setSelectedArtwork(artwork);
  }, [artworks]);

  const handleNext = useCallback(() => {
    if (selectedIndex < artworks.length - 1) {
      const nextIndex = selectedIndex + 1;
      setSelectedIndex(nextIndex);
      setSelectedArtwork(artworks[nextIndex]);
    }
  }, [selectedIndex, artworks]);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelectedIndex(prevIndex);
      setSelectedArtwork(artworks[prevIndex]);
    }
  }, [selectedIndex, artworks]);

  const getGridClasses = (density: GridDensity) => {
    switch (density) {
      case 'comfortable':
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6";
      case 'compact':
        return "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4";
      case 'dense':
        return "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Grid density controls skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 w-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
        
        {/* Grid skeleton */}
        <div className={cn("grid", getGridClasses(gridDensity))}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[4/3] bg-muted animate-pulse rounded-xl" />
              <div className="space-y-2 p-4">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                <div className="flex justify-between">
                  <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (artworks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No artworks found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search terms
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid controls */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {artworks.length} artwork{artworks.length !== 1 ? 's' : ''}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={gridDensity === 'comfortable' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGridDensity('comfortable')}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={gridDensity === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGridDensity('compact')}
            className="h-8 w-8 p-0"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={gridDensity === 'dense' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGridDensity('dense')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className={cn("grid", getGridClasses(gridDensity))}>
        {artworks.map((artwork) => (
          <ModernArtworkCard
            key={artwork.id}
            artwork={artwork}
            onView={handleView}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={onDelete}
            onFavorite={onFavorite}
            onShare={onShare}
            showActions={showActions}
            compact={gridDensity === 'dense'}
          />
        ))}
      </div>

      {/* Full screen viewer */}
      <FullScreenImageViewer
        artwork={selectedArtwork}
        artworks={artworks}
        currentIndex={selectedIndex}
        open={!!selectedArtwork}
        onOpenChange={(open) => !open && setSelectedArtwork(null)}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onEdit={onEdit}
        onExport={onExport}
        onShare={onShare}
      />
    </div>
  );
}