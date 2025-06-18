
import { SearchBar } from "./SearchBar";
import { StatusFilter } from "./StatusFilter";
import { TypeFilter } from "./TypeFilter";
import { ArtistFilter } from "./ArtistFilter";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ArtworksFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  typeFilter: string | null;
  onTypeFilterChange: (value: string | null) => void;
  artistFilter: string | null;
  onArtistFilterChange: (value: string | null) => void;
  onShowAll: () => void;
}

export function ArtworksFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  artistFilter,
  onArtistFilterChange,
  onShowAll
}: ArtworksFiltersProps) {
  const hasActiveFilters = searchTerm || statusFilter || typeFilter || artistFilter;

  return (
    <div className="mb-2 md:mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:max-w-sm flex items-center gap-2">
          <SearchBar value={searchTerm} onChange={onSearchChange} />
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShowAll}
              className="flex-shrink-0 h-8 w-8 p-0"
              title="Show all artworks"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-row items-center gap-3 sm:gap-4 overflow-x-auto pb-1 sm:ml-auto">
          <div className="flex-shrink-0 w-[85px] sm:w-[100px]">
            <StatusFilter value={statusFilter} onChange={onStatusFilterChange} />
          </div>
          <div className="flex-shrink-0 w-[85px] sm:w-[100px]">
            <TypeFilter value={typeFilter} onChange={onTypeFilterChange} />
          </div>
          <div className="flex-shrink-0 w-[85px] sm:w-[100px]">
            <ArtistFilter value={artistFilter} onChange={onArtistFilterChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
