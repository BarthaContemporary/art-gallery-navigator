
import { Button } from "@/components/ui/button";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { Download, PlusCircle } from "lucide-react";
import { exportArtistsToCSV } from "../utils/csvExport";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

interface ArtistsHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateArtist: () => void;
  artists?: Artist[];
  filteredArtists: Artist[];
}

export const ArtistsHeader = ({
  viewMode,
  onViewModeChange,
  onCreateArtist,
  artists,
  filteredArtists
}: ArtistsHeaderProps) => {
  const handleExportAll = () => {
    if (artists) {
      exportArtistsToCSV(artists, 'all_artists.csv');
    }
  };

  const handleExportFiltered = () => {
    if (filteredArtists.length) {
      exportArtistsToCSV(filteredArtists, 'filtered_artists.csv');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-4">
      <div className="flex flex-wrap gap-2">
        <Button 
          size="sm" 
          className="flex gap-1 sm:gap-2 text-xs sm:text-sm" 
          onClick={onCreateArtist}
        >
          <PlusCircle className="h-3 w-3 sm:h-4 sm:w-4" />
          Add Artist
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex gap-1 sm:gap-2 text-xs sm:text-sm" 
          onClick={handleExportFiltered} 
          disabled={!filteredArtists.length}
        >
          <Download className="h-3 w-3 sm:h-4 sm:w-4" />
          Export {filteredArtists.length !== artists?.length ? 'Filtered' : 'All'}
        </Button>
        {filteredArtists.length !== artists?.length && (artists?.length ?? 0) > 0 && 
          <Button 
            variant="outline" 
            size="sm" 
            className="flex gap-1 sm:gap-2 text-xs sm:text-sm" 
            onClick={handleExportAll}
          >
            <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            Export All ({artists?.length})
          </Button>
        }
      </div>
      
      <ViewToggle 
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
    </div>
  );
};
