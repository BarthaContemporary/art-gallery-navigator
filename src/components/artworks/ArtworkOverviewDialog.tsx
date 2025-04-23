
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Edit, FileText } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkCarousel } from "./ArtworkCarousel";
import { useState } from "react";
import { EditArtworkDialog } from "./EditArtworkDialog";
import { useToast } from "@/hooks/use-toast";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { supabase } from "@/integrations/supabase/client";
import { useArtist } from "@/hooks/use-artist";
import { useLocation } from "@/hooks/use-location";
import { ArtworkDetailsSection } from "./overview/ArtworkDetailsSection";
import { DimensionsSection } from "./overview/DimensionsSection";
import { AdditionalInfoSection } from "./overview/AdditionalInfoSection";
import { LocationStatusSection } from "./overview/LocationStatusSection";

interface ArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialog({ artwork, open, onOpenChange }: ArtworkOverviewDialogProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isCreatingPDF, setIsCreatingPDF] = useState(false);
  const { toast } = useToast();
  const { data: artist, isLoading: artistLoading } = useArtist(artwork.artist_id);
  const { data: location, isLoading: locationLoading } = useLocation(artwork.location_id);

  const handleCreatePDF = async () => {
    if (isCreatingPDF) return;
    
    try {
      setIsCreatingPDF(true);
      toast({ title: "Creating PDF...", description: "Please wait a moment" });
      
      const pdfUrl = await createArtworkPDF(artwork);
      toast({ 
        title: "PDF Created Successfully", 
        description: "The document has been saved to your documents library" 
      });
    } catch (error) {
      console.error("Error creating PDF:", error);
      toast({ 
        title: "Error Creating PDF", 
        description: "Please try again later", 
        variant: "destructive" 
      });
    } finally {
      setIsCreatingPDF(false);
    }
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-2xl">{artwork.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Carousel */}
            <ArtworkCarousel artworkId={artwork.id} />

            {/* Artwork Details Sections (refactored) */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ArtworkDetailsSection
                  artwork={artwork}
                  artist={artist}
                  artistLoading={artistLoading}
                />
                <DimensionsSection artwork={artwork} />
              </div>
              <AdditionalInfoSection artwork={artwork} />
              <LocationStatusSection
                artwork={artwork}
                location={location}
                locationLoading={locationLoading}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button onClick={handleCreatePDF} disabled={isCreatingPDF}>
                <FileText className="mr-2 h-4 w-4" />
                {isCreatingPDF ? "Creating PDF..." : "Create PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <EditArtworkDialog 
        artwork={artwork}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
