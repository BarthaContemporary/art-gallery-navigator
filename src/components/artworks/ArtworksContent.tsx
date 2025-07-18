
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { SimpleArtworkGrid } from "./SimpleArtworkGrid";
import { ArtworkListView } from "./ArtworkListView";
import { ArtworksFilters } from "./ArtworksFilters";
import { ViewMode } from "./ArtworkViewToggle";

interface ArtworksContentProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  artworks: Artwork[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  typeFilter: string | null;
  onTypeFilterChange: (type: string | null) => void;
  artistFilter: string | null;
  onArtistFilterChange: (artist: string | null) => void;
  onShowAll: () => void;
}

export function ArtworksContent({ 
  viewMode, 
  onViewModeChange, 
  artworks,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  artistFilter,
  onArtistFilterChange,
  onShowAll
}: ArtworksContentProps) {
  return (
    <div className="space-y-6">
      <ArtworksFilters
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
        artistFilter={artistFilter}
        onArtistFilterChange={onArtistFilterChange}
        onShowAll={onShowAll}
      />
      
      {viewMode === "grid" && (
        <SimpleArtworkGrid artworks={artworks} />
      )}
      {viewMode === "list" && (
        <ArtworkListView artworks={artworks} />
      )}
    </div>
  );
}
