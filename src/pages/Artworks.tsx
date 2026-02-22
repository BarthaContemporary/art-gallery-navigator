/**
 * Clean Artworks Page
 * Simple, reliable artwork management interface
 */

import React, { useRef, useState, useMemo } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { ArtworkFilters } from "@/components/artworks/ArtworkFilters";
import { ArtistSelectionGrid } from "@/components/artworks/ArtistSelectionGrid";
import { ArtworkSelectionToolbar } from "@/components/artworks/selection/ArtworkSelectionToolbar";
import { BulkDeleteDialog } from "@/components/artworks/dialogs/BulkDeleteDialog";
import { GlobalDialogRenderer } from "@/components/artworks/dialogs/GlobalDialogRenderer";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { QuickImageUploader } from "@/components/artworks/QuickImageUploader";
import { ImportCSVDialog } from "@/components/artworks/ImportCSVDialog";
import { ExportToGoogleSheetsButton } from "@/components/artworks/ExportToGoogleSheetsButton";
import { NewCollectionFromArtworksButton } from "@/components/artworks/NewCollectionFromArtworksButton";
import { CreateCollectionDialog } from "@/components/artworks/dialogs/CreateCollectionDialog";
import { useArtworks, useArtists } from "@/hooks/use-artworks";
import { useArtworkFilters } from "@/hooks/use-artwork-filters";
import { useArtworkSelection } from "@/hooks/use-artwork-selection";
import { useBulkDeleteArtworks } from "@/components/artworks/hooks/useBulkDeleteArtworks";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";
import { withErrorBoundary } from "@/components/ui/error-boundary";

function Artworks() {
  const pageTopRef = useRef<HTMLDivElement>(null);
  const { isAdmin, isArtist } = useAuth();
  const [showCreateCollectionDialog, setShowCreateCollectionDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
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

  const {
    selectedIds,
    selectedArtworks,
    selectedCount,
    allSelected,
    someSelected,
    isSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
  } = useArtworkSelection(filteredArtworks);

  const { bulkDeleteArtworks, isDeleting } = useBulkDeleteArtworks();

  const isLoading = artworksLoading || artistsLoading;
  const hasError = artworksError || artistsError;
  const showArtistSelection = !filters.artist && !isSelectionMode;

  // Find selected artist name for the back button
  const selectedArtistName = useMemo(() => {
    if (!filters.artist) return null;
    const artist = artists.find(a => a.id === filters.artist);
    return artist?.full_name || 'Selected Artist';
  }, [filters.artist, artists]);

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

  const handleCreateCollectionFromSelected = () => {
    setShowCreateCollectionDialog(true);
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleConfirmBulkDelete = async () => {
    await bulkDeleteArtworks(selectedArtworks);
    exitSelectionMode();
    setShowBulkDeleteDialog(false);
  };

  const handleSelectArtist = (artistId: string) => {
    updateFilter('artist', artistId);
  };

  const handleBackToArtists = () => {
    updateFilter('artist', null);
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
              <MaterialIcon icon="refresh" size={16} className="mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="container mx-auto px-4 flex-1 flex flex-col space-y-4 min-h-0">
        <div ref={pageTopRef} />
      
      {/* Selection Toolbar */}
      {isSelectionMode && (
        <ArtworkSelectionToolbar
          selectedCount={selectedCount}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onCreateCollection={handleCreateCollectionFromSelected}
          onBulkDelete={handleBulkDelete}
          onExitSelectionMode={exitSelectionMode}
        />
      )}
      
      {/* Header */}
      {!isSelectionMode && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreateArtworkDialog />
            <QuickImageUploader onArtworkCreated={() => refetchArtworks()} />
            <NewCollectionFromArtworksButton filteredArtworks={filteredArtworks} />
            {isAdmin && (
              <>
                <ExportToGoogleSheetsButton artworks={filteredArtworks} />
                <ImportCSVDialog />
              </>
            )}
          </div>
        </div>
      )}

      {/* Search + controls bar */}
      {!isSelectionMode && (
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-80">
            <MaterialIcon icon="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={showArtistSelection ? "Search artists..." : "Search artworks, artists, materials..."}
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10 bg-[#F5F5F5]"
            />
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {/* Back to artists button when viewing an artist's works */}
            {filters.artist && (
              <Button
                variant="outline"
                onClick={handleBackToArtists}
                className="gap-1.5"
              >
                <MaterialIcon icon="arrow_back" size={16} />
                <span className="hidden sm:inline">All Artists</span>
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              size="icon"
            >
              <MaterialIcon icon="refresh" size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                size="icon"
              >
                <MaterialIcon icon="close" size={16} />
              </Button>
            )}
            
            {!showArtistSelection && (
              <Button
                variant="outline"
                onClick={enterSelectionMode}
                disabled={filteredArtworks.length === 0}
                size="icon"
              >
                <MaterialIcon icon="check_box" size={16} />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Artist Selection View or Artwork Grid View */}
      {showArtistSelection ? (
        <div className="flex-1 overflow-auto">
          {selectedArtistName && (
            <div className="mb-3 text-sm text-muted-foreground">
              Showing works by <span className="font-medium text-foreground">{selectedArtistName}</span>
            </div>
          )}
          <ArtistSelectionGrid
            artists={filterOptions.artists}
            searchQuery={filters.search}
            onSelectArtist={handleSelectArtist}
          />
        </div>
      ) : (
        <>
          {/* Filters - only show when viewing artworks */}
          {!isSelectionMode && (
            <ArtworkFilters
              filters={filters}
              filterOptions={{
                statuses: filterOptions.statuses,
                mediumTypes: filterOptions.mediumTypes,
                artists: isArtist ? [] : filterOptions.artists,
                yearRange: filterOptions.yearRange as [number, number],
                priceRange: filterOptions.priceRange as [number, number],
              }}
              onUpdateFilter={updateFilter}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              artworkCount={filteredArtworks.length}
            />
          )}

          {/* Grid */}
          <div className="flex-1 overflow-hidden">
            <ArtworkGrid
              artworks={filteredArtworks}
              loading={isLoading}
              onScrollToTop={handleScrollToTop}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onToggleSelection={toggleSelection}
              onEnterSelectionMode={enterSelectionMode}
            />
          </div>
        </>
      )}

      {/* Dialogs */}
      <CreateCollectionDialog
        open={showCreateCollectionDialog}
        onOpenChange={setShowCreateCollectionDialog}
        filteredArtworks={selectedArtworks}
      />

      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        artworks={selectedArtworks}
        onConfirm={handleConfirmBulkDelete}
        isDeleting={isDeleting}
      />

      {/* Global Dialog Renderer for artwork overview, edit, and delete dialogs */}
      <GlobalDialogRenderer />
      </div>
    </div>
  );
}

export default withErrorBoundary(Artworks);
