
/**
 * Clean Artworks Page
 * Simple, reliable artwork management interface
 */

import React, { useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { ArtworkFilters } from "@/components/artworks/ArtworkFilters";
import { ArtworkSelectionToolbar } from "@/components/artworks/selection/ArtworkSelectionToolbar";
import { BulkDeleteDialog } from "@/components/artworks/dialogs/BulkDeleteDialog";
import { GlobalDialogRenderer } from "@/components/artworks/dialogs/GlobalDialogRenderer";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { ImportCSVDialog } from "@/components/artworks/ImportCSVDialog";
import { ExportToGoogleSheetsButton } from "@/components/artworks/ExportToGoogleSheetsButton";
import { NewCollectionFromArtworksButton } from "@/components/artworks/NewCollectionFromArtworksButton";
import { CreateCollectionDialog } from "@/components/artworks/dialogs/CreateCollectionDialog";
import { CurrencySelector } from "@/components/artworks/CurrencySelector";
import { useArtworks, useArtists } from "@/hooks/use-artworks";
import { useArtworkFilters } from "@/hooks/use-artwork-filters";
import { useArtworkSelection } from "@/hooks/use-artwork-selection";
import { useBulkDeleteArtworks } from "@/components/artworks/hooks/useBulkDeleteArtworks";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

export default function Artworks() {
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
            <NewCollectionFromArtworksButton filteredArtworks={filteredArtworks} />
            {isAdmin && (
              <>
                <ExportToGoogleSheetsButton artworks={filteredArtworks} />
                <ImportCSVDialog />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={enterSelectionMode}
              disabled={filteredArtworks.length === 0}
              size="icon"
            >
              <MaterialIcon icon="check_box" size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      {!isSelectionMode && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MaterialIcon icon="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search artworks, artists, materials..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>
            
            <CurrencySelector />
            
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
          </div>
          
          <ArtworkFilters
            filters={filters}
            filterOptions={{
              statuses: filterOptions.statuses,
              mediumTypes: filterOptions.mediumTypes,
              artists: isArtist ? [] : filterOptions.artists, // Hide artist options for artist users
              yearRange: filterOptions.yearRange as [number, number],
              priceRange: filterOptions.priceRange as [number, number],
            }}
            onUpdateFilter={updateFilter}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            artworkCount={filteredArtworks.length}
          />
        </div>
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
