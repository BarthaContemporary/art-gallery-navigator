
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Upload, ArrowUp, Settings } from "lucide-react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ExportToGoogleDocsButton } from "./ExportToGoogleDocsButton";
import { exportArtworksToCSV } from "@/lib/csv";
import { ArtworkViewToggle, ViewMode } from "./ArtworkViewToggle";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";

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
  onViewModeChange,
}: ArtworksHeaderProps) {
  const { isAdmin } = useAuth();

  const handleExportCSV = () => {
    exportArtworksToCSV(filteredArtworks, "artworks.csv");
  };

  return (
    <div className="space-y-4 mb-4 md:mb-6">
      {/* Single row with Add Artwork on left, Admin tools and View Toggle on right */}
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          {isAdmin && <CreateArtworkDialog />}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Admin tools */}
          {isAdmin && (
            <>
              <ExportToGoogleDocsButton 
                artworks={filteredArtworks} 
                className="hidden sm:flex"
              />

              <Button variant="outline" size="sm" onClick={handleExportCSV} className="hidden sm:flex">
                <ArrowUp className="h-4 w-4 rotate-180" />
              </Button>

              <div className="hidden sm:block">
                <ImportCSVDialog />
              </div>
            </>
          )}
          
          <ArtworkViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </div>
      </div>
    </div>
  );
}
