
import { useState } from "react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ArtworkViewToggle, ViewMode } from "./ArtworkViewToggle";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { exportArtworksToCSV } from "@/lib/csv";
import { useImageCache } from "@/hooks/use-image-cache";
import { toast } from "sonner";
import { Artwork } from "@/hooks/use-artworks";

interface ArtworksHeaderProps {
  artworks: Artwork[];
  filteredArtworks: Artwork[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ArtworksHeader({
  artworks,
  filteredArtworks,
  viewMode,
  onViewModeChange
}: ArtworksHeaderProps) {
  const { clearImageCache } = useImageCache();

  const handleExportAll = () => {
    if (artworks) {
      exportArtworksToCSV(artworks, 'all_artworks.csv');
    }
  };

  const handleExportFiltered = () => {
    if (filteredArtworks.length) {
      exportArtworksToCSV(filteredArtworks, 'filtered_artworks.csv');
    }
  };

  const handleClearImageCache = () => {
    clearImageCache();
    toast.success("Image cache cleared. Refresh the page to reload images.");
  };

  return (
    <div className="flex flex-wrap items-center justify-between mb-4 md:mb-6 gap-2">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <CreateArtworkDialog />
        <ImportCSVDialog />
        <Button 
          variant="outline" 
          size="sm" 
          className="flex gap-1 md:gap-2 text-xs md:text-sm" 
          onClick={handleExportFiltered} 
          disabled={!filteredArtworks.length}
        >
          <Download className="h-3 w-3 md:h-4 md:w-4" />
          Export {filteredArtworks.length !== artworks?.length ? 'Filtered' : 'All'}
        </Button>
        {filteredArtworks.length !== artworks?.length && artworks?.length && artworks.length > 0 && 
          <Button 
            variant="outline" 
            size="sm" 
            className="flex gap-1 md:gap-2 text-xs md:text-sm" 
            onClick={handleExportAll}
          >
            <Download className="h-3 w-3 md:h-4 md:w-4" />
            Export All ({artworks.length})
          </Button>
        }
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-2" 
          title="Clear Image Cache" 
          onClick={handleClearImageCache}
        >
          <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <ArtworkViewToggle 
          viewMode={viewMode} 
          onViewModeChange={onViewModeChange}
        />
      </div>
    </div>
  );
}
