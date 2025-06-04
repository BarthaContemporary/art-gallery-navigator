
import { useState } from "react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ArtworkViewToggle, ViewMode } from "./ArtworkViewToggle";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Settings } from "lucide-react";
import { exportArtworksToCSV } from "@/lib/csv";
import { useImageCache } from "@/hooks/use-image-cache";
import { toast } from "sonner";
import { Artwork } from "@/hooks/use-artworks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtworksHeaderProps {
  artworks: Artwork[];
  filteredArtworks: Artwork[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  useVirtualization: boolean;
  onVirtualizationChange: (enabled: boolean) => void;
}

export function ArtworksHeader({
  artworks,
  filteredArtworks,
  viewMode,
  onViewModeChange,
  useVirtualization,
  onVirtualizationChange
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
          className="hidden md:flex"
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline ml-2">Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>View Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onViewModeChange('grid')}
              className={viewMode === 'grid' ? 'bg-accent' : ''}
            >
              Grid View
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onViewModeChange('list')}
              className={viewMode === 'list' ? 'bg-accent' : ''}
            >
              List View
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onViewModeChange('table')}
              className={viewMode === 'table' ? 'bg-accent' : ''}
            >
              Table View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Performance</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => onVirtualizationChange(!useVirtualization)}
            >
              {useVirtualization ? '✓' : '○'} Virtualization
              <span className="text-xs text-muted-foreground ml-2">
                (Large datasets)
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
