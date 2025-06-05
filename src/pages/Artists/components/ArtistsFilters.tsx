
import { SearchBar } from "@/components/artists/SearchBar";
import { RepresentationStatusFilter } from "@/components/artists/RepresentationStatusFilter";

type RepresentationStatusFilterType = "all" | "represented" | "formerly represented" | "not represented";

interface ArtistsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: RepresentationStatusFilterType;
  onStatusFilterChange: (value: RepresentationStatusFilterType) => void;
}

export const ArtistsFilters = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}: ArtistsFiltersProps) => {
  return (
    <div className="mb-4 md:mb-8 grid grid-cols-1 sm:flex sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
      <div className="w-full sm:max-w-sm">
        <SearchBar value={searchTerm} onChange={onSearchChange} />
      </div>
      <div className="w-full sm:w-auto">
        <RepresentationStatusFilter value={statusFilter} onChange={onStatusFilterChange} /> 
      </div>
    </div>
  );
};
