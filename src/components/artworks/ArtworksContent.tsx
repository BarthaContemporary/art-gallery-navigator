import React, { useState, useMemo } from "react";
import { useArtworks } from "@/hooks/use-artworks";
import { ArtworkGrid } from "./ArtworkGrid";
import { ArtworkListView } from "./ArtworkListView";
import { ArtworkFiltersBar } from "./ArtworksFilters";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  
  // Check storage bucket configuration on mount
  useStorageBucketChecker();

  const filteredArtworks = useMemo(() => {
    return artworks.filter((artwork) => {
      const matchesSearch = artwork.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artwork.artist_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesArtist = !selectedArtist || artwork.artist_id === selectedArtist;
      const matchesStatus = !selectedStatus || artwork.status?.toLowerCase() === selectedStatus.toLowerCase();
      const matchesType = !selectedType || artwork.medium_type?.toLowerCase() === selectedType.toLowerCase();
      
      return matchesSearch && matchesArtist && matchesStatus && matchesType;
    });
  }, [artworks, searchQuery, selectedArtist, selectedStatus, selectedType]);

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
      <div className="flex flex-col gap-4">
        <SearchBar 
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery} 
        />
        <ArtworkFiltersBar
          artworks={artworks}
          selectedArtist={selectedArtist}
          onArtistChange={setSelectedArtist}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>
      
      {viewMode === "grid" && (
        <ArtworkGrid artworks={filteredArtworks} />
      )}
      {viewMode === "virtualized" && (
        <VirtualizedArtworkGrid artworks={filteredArtworks} />
      )}
      {viewMode === "list" && (
        <ArtworkListView artworks={filteredArtworks} />
      )}
    </div>
  );
}
