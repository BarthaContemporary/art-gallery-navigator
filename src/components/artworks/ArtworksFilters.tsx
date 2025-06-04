
import { SearchBar } from "./SearchBar";
import { StatusFilter } from "./StatusFilter";
import { TypeFilter } from "./TypeFilter";
import { ArtistFilter } from "./ArtistFilter";

interface ArtworksFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  typeFilter: string | null;
  onTypeFilterChange: (value: string | null) => void;
  artistFilter: string | null;
  onArtistFilterChange: (value: string | null) => void;
}

export function ArtworksFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  artistFilter,
  onArtistFilterChange
}: ArtworksFiltersProps) {
  return (
    <div className="mb-4 md:mb-8">
      <div className="w-full mb-3 md:mb-4">
        <SearchBar value={searchTerm} onChange={onSearchChange} />
      </div>
      <div className="flex flex-row items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
        <div className="flex-shrink-0 w-[100px] sm:w-[140px]">
          <StatusFilter value={statusFilter} onChange={onStatusFilterChange} />
        </div>
        <div className="flex-shrink-0 w-[100px] sm:w-[140px]">
          <TypeFilter value={typeFilter} onChange={onTypeFilterChange} />
        </div>
        <div className="flex-shrink-0 w-[100px] sm:w-[140px] md:w-[180px]">
          <ArtistFilter value={artistFilter} onChange={onArtistFilterChange} />
        </div>
      </div>
    </div>
  );
}
