/**
 * Clean Artworks Page
 * Simple, reliable artwork management interface
 */

import React, { useRef } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { ArtworkFilters } from "@/components/artworks/ArtworkFilters";
import { useArtworks, useArtists } from "@/hooks/use-artworks";
import { useArtworkFilters } from "@/hooks/use-artwork-filters";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

export default function Artworks() {
  const pageTopRef = useRef<HTMLDivElement>(null);
  
  const {
    data: artworks = [],
    isLoading: artworksLoading,
    error: artworksError,
    refetch: refetchArtworks
  } = useArtworks();

  const {
    data: artists = [],
    isLoading: artistsLoading,
    error: artistsError,
    refetch: refetchArtists
  } = useArtists();

  const {
    filters,
    filteredArtworks,
    filterOptions,
    updateFilter,
    clearFilters,
    hasActiveFilters
  } = useArtworkFilters(artworks, artists);

  const isLoading = artworksLoading || artistsLoading;
  const hasError = artworksError || artistsError;

  const handleRefresh = async () => {
    try {
      await Promise.all([refetchArtworks(), refetchArtists()]);
      toast.success("Artworks refreshed successfully");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh artworks");
    }
  };

  const handleScrollToTop = () => {
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Placeholder handlers for actions (implement as needed)
  const handleEdit = (artwork: Artwork) => {
    toast.info(`Edit functionality for "${artwork.title}" would be implemented here`);
  };

  const handleDuplicate = (artwork: Artwork) => {
    toast.info(`Duplicate functionality for "${artwork.title}" would be implemented here`);
  };

  const handleExport = (artwork: Artwork) => {
    toast.info(`Export functionality for "${artwork.title}" would be implemented here`);
  };

  const handleDelete = (artwork: Artwork) => {
    toast.info(`Delete functionality for "${artwork.title}" would be implemented here`);
  };

  const handleFavorite = (artwork: Artwork) => {
    toast.info(`Favorite functionality for "${artwork.title}" would be implemented here`);
  };

  const handleShare = (artwork: Artwork) => {
    toast.info(`Share functionality for "${artwork.title}" would be implemented here`);
  };

  if (hasError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 text-destructive">
              Failed to load artworks
            </h3>
            <p className="text-muted-foreground mb-4">
              There was an error loading the artwork data.
            </p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div ref={pageTopRef} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Artworks</h1>
          <p className="text-muted-foreground">
            Manage and explore the gallery collection
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {filteredArtworks.length > 20 && (
            <Button
              variant="outline"
              onClick={handleScrollToTop}
            >
              Back to Top
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <ArtworkFilters
        filters={filters}
        filterOptions={filterOptions}
        onUpdateFilter={updateFilter}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        artworkCount={filteredArtworks.length}
      />

      {/* Grid */}
      <ArtworkGrid
        artworks={filteredArtworks}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onExport={handleExport}
        onDelete={handleDelete}
        onFavorite={handleFavorite}
        onShare={handleShare}
        loading={isLoading}
      />
    </div>
  );
}
