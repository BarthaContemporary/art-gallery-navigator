
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Settings } from "lucide-react";
import { CreateArtworkDialog } from "./CreateArtworkDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ExportToGoogleDocsButton } from "./ExportToGoogleDocsButton";
import { BulkImageOptimizer } from "./BulkImageOptimizer";
import { ImageReprocessingButton } from "./ImageReprocessingButton";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export function ArtworksHeader() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
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
              
              <ExportToGoogleDocsButton />
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </>
          )}
          
          <Button 
            onClick={() => setShowCreateDialog(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Artwork
          </Button>
        </div>
      </div>

      <CreateArtworkDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
      
      {isAdmin && (
        <>
          <ImportCSVDialog 
            open={showImportDialog} 
            onOpenChange={setShowImportDialog} 
          />
          
          <BulkImageOptimizer 
            open={showBulkOptimizer}
            onOpenChange={setShowBulkOptimizer}
          />
        </>
      )}
    </>
  );
}
