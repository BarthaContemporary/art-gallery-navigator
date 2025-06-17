
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Upload, ArrowUp, Settings, Image } from "lucide-react";
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-4">
      <div className="flex flex-wrap gap-2">
        {isAdmin && <CreateArtworkDialog />}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {isAdmin && (
          <>
            <Dialog open={optimizerDialogOpen} onOpenChange={setOptimizerDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <Image className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Image Optimization</DialogTitle>
                </DialogHeader>
                <BulkImageOptimizer />
              </DialogContent>
            </Dialog>

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
  );
}
