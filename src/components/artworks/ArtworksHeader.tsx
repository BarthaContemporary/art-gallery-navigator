
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Settings } from "lucide-react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ExportToGoogleDocsButton } from "./ExportToGoogleDocsButton";
import { BulkImageOptimizer } from "./BulkImageOptimizer";
import { ImageReprocessingButton } from "./ImageReprocessingButton";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { ViewMode } from "./ArtworkViewToggle";

interface ArtworksHeaderProps {
  artworks: Artwork[];
  filteredArtworks: Artwork[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ArtworksHeader({ artworks, filteredArtworks }: ArtworksHeaderProps) {
  const [showBulkOptimizer, setShowBulkOptimizer] = useState(false);
  const { isAdmin } = useAuth();

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Artworks</h1>
        <div className="flex gap-2">
          <ImageReprocessingButton />
          
          {isAdmin && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowBulkOptimizer(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Optimize Images
              </Button>
              
              <ExportToGoogleDocsButton artworks={artworks} />
              
              <ImportCSVDialog />
            </>
          )}
          
          <CreateArtworkDialog />
        </div>
      </div>

      {isAdmin && showBulkOptimizer && (
        <BulkImageOptimizer 
          open={showBulkOptimizer}
          onOpenChange={setShowBulkOptimizer}
        />
      )}
    </>
  );
}
