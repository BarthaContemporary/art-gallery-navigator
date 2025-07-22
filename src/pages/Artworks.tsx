
/**
 * Clean Artworks Page
 * Simple, reliable artwork management interface
 */

import React, { useRef } from "react";
import { RefreshCw, Search, X, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { ArtworkFilters } from "@/components/artworks/ArtworkFilters";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { ImportCSVDialog } from "@/components/artworks/ImportCSVDialog";
import { ExportToGoogleSheetsButton } from "@/components/artworks/ExportToGoogleSheetsButton";
import { NewCollectionFromArtworksButton } from "@/components/artworks/NewCollectionFromArtworksButton";
import { useArtworks, useArtists } from "@/hooks/use-artworks";
import { useArtworkFilters } from "@/hooks/use-artwork-filters";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

export default function Artworks() {
  const pageTopRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAuth();
  
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
    <div className="container mx-auto px-4 pt-4 pb-8 space-y-8">
      <div ref={pageTopRef} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6 gap-3">
        <div className="flex items-center gap-2">
          <CreateArtworkDialog />
          <NewCollectionFromArtworksButton filteredArtworks={filteredArtworks} />
          {isAdmin && (
            <>
              <ExportToGoogleSheetsButton artworks={artworks} />
              <ImportCSVDialog />
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artworks, artists, materials..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="whitespace-nowrap"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>
        
        <ArtworkFilters
          filters={filters}
          filterOptions={{
            statuses: filterOptions.statuses,
            mediumTypes: filterOptions.mediumTypes,
            artists: filterOptions.artists,
            yearRange: filterOptions.yearRange as [number, number],
            priceRange: filterOptions.priceRange as [number, number],
          }}
          onUpdateFilter={updateFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          artworkCount={filteredArtworks.length}
        />
      </div>

      {/* Grid */}
      <ArtworkGrid
        artworks={filteredArtworks}
        loading={isLoading}
      />
    </div>
  );
}
