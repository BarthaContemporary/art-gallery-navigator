
import { Button } from "@/components/ui/button";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { PlusCircle } from "lucide-react";

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
}: ArtistsHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-4">
      <div className="flex flex-wrap gap-2">
        <Button 
          size="sm" 
          className="flex gap-2" 
          onClick={onCreateArtist}
        >
          <PlusCircle className="h-4 w-4" />
          Add Artist
        </Button>
      </div>
      
      <ViewToggle 
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
    </div>
  );
};
