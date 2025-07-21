
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Settings, ArrowDown } from "lucide-react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ExportToGoogleDocsButton } from "./ExportToGoogleDocsButton";
import { ExportToGoogleSheetsButton } from "./ExportToGoogleSheetsButton";
import { BulkImageOptimizer } from "./BulkImageOptimizer";
import { ImageReprocessingButton } from "./ImageReprocessingButton";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ViewMode } from "./ArtworkViewToggle";
import { exportArtworksToCSV } from "@/lib/csv/export-artworks-csv";

interface ArtworksHeaderProps {
  artworks: Artwork[];
  filteredArtworks: Artwork[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ArtworksHeader({ artworks, filteredArtworks }: ArtworksHeaderProps) {
  const [showBulkOptimizer, setShowBulkOptimizer] = useState(false);
  const { isAdmin } = useAuth();

  const handleCSVExport = () => {
    exportArtworksToCSV(artworks, 'artworks-export.csv');
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <CreateArtworkDialog />
        
        <div className="flex gap-2">
          <ImageReprocessingButton />
          
          {isAdmin && (
            <>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowBulkOptimizer(true)}
                title="Optimize Images"
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <ExportToGoogleDocsButton artworks={artworks} />
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleCSVExport}
                disabled={artworks.length === 0}
                title={artworks.length === 0 ? "No artworks to export" : "Export to CSV"}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              
              <ExportToGoogleSheetsButton artworks={artworks} />
              
              <ImportCSVDialog />
            </>
          )}
        </div>
      </div>

      {isAdmin && showBulkOptimizer && (
        <div className="mb-6">
          <BulkImageOptimizer />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowBulkOptimizer(false)}
            className="mt-4"
          >
            Close Optimizer
          </Button>
        </div>
      )}
    </>
  );
}
