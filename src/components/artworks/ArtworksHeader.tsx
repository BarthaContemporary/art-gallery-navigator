
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Upload, FileDown, Settings, Wand2 } from "lucide-react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { exportArtworksToCSV } from "@/lib/csv";
import { ArtworkViewToggle, ViewMode } from "./ArtworkViewToggle";
import { Artwork } from "@/hooks/use-artworks";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BulkImageOptimizer } from "./BulkImageOptimizer";

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
  const [optimizerDialogOpen, setOptimizerDialogOpen] = useState(false);

  const handleExportCSV = () => {
    exportArtworksToCSV(filteredArtworks, "artworks.csv");
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && <CreateArtworkDialog />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <>
            <Dialog open={optimizerDialogOpen} onOpenChange={setOptimizerDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Optimize Images
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Image Optimization</DialogTitle>
                </DialogHeader>
                <BulkImageOptimizer />
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <ImportCSVDialog />
          </>
        )}
        
        <ArtworkViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </div>
  );
}
