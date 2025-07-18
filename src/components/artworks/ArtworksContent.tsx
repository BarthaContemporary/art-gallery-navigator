
import React, { useState, useMemo } from "react";
import { useArtworks } from "@/hooks/use-artworks";
import { FastArtworkGrid } from "./FastArtworkGrid";
import { ArtworkListView } from "./ArtworkListView";
import { ArtworksFilters } from "./ArtworksFilters";
import { SearchBar } from "./SearchBar";
import { VirtualizedArtworkGrid } from "./VirtualizedArtworkGrid";
import { ViewMode } from "./ArtworkViewToggle";
import { useStorageBucketChecker } from "@/hooks/use-storage-bucket-checker";

interface ArtworksContentProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ArtworksContent({ viewMode, onViewModeChange }: ArtworksContentProps) {
  const { data: artworks = [], isLoading, error } = useArtworks();
  const [searchTerm, setSearchTerm] = useState("");
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  
  // Check storage bucket configuration on mount
  useStorageBucketChecker();

  const filteredArtworks = useMemo(() => {
    return artworks.filter((artwork) => {
      const matchesSearch = artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artwork.artist_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesArtist = !artistFilter || artwork.artist_id === artistFilter;
      const matchesStatus = !statusFilter || artwork.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesType = !typeFilter || artwork.medium_type?.toLowerCase() === typeFilter.toLowerCase();
      
      return matchesSearch && matchesArtist && matchesStatus && matchesType;
    });
  }, [artworks, searchTerm, artistFilter, statusFilter, typeFilter]);

  const handleShowAll = () => {
    setSearchTerm("");
    setArtistFilter(null);
    setStatusFilter(null);
    setTypeFilter(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading artworks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-500">Error loading artworks: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ArtworksFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        artistFilter={artistFilter}
        onArtistFilterChange={setArtistFilter}
        onShowAll={handleShowAll}
      />
      
      {viewMode === "grid" && (
        <FastArtworkGrid artworks={filteredArtworks} />
      )}
      {viewMode === "list" && (
        <ArtworkListView artworks={filteredArtworks} />
      )}
    </div>
  );
}
