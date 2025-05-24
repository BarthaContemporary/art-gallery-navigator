
import React, { useState, useCallback, useEffect } from "react"; // Added useEffect
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
import { useLocation } from "@/hooks/use-location";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { toast } from "sonner";
// PDFPreviewDialog is no longer directly used for preview before generation
// import { PDFPreviewDialog } from "../pdf/PDFPreviewDialog"; 
// ArtworkPDFPreview is also not directly used here anymore if PDFPreviewDialog is removed
// import { ArtworkPDFPreview } from "../pdf/ArtworkPreview"; 
import { ArtworkCarousel } from "./ArtworkCarousel";
import { DialogHeaderActions } from "./overview/DialogHeaderActions";
import { useFileOperations } from "./overview/useFileOperations";

// New components
import { ArtworkOverviewPrimaryInfo } from "./overview/ArtworkOverviewPrimaryInfo";
import { ArtworkOverviewCollapsibleInfo } from "./overview/ArtworkOverviewCollapsibleInfo";

interface ArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtworkOverviewDialog({
  artwork,
  open,
  onOpenChange,
}: ArtworkOverviewDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  // setPDFPreviewOpen is still needed because DialogHeaderActions (read-only) calls it.
  // We will use its change to trigger PDF generation directly via useEffect.
  const [pdfPreviewOpen, setPDFPreviewOpen] = useState(false);
  const { data: artist, isLoading: artistLoading } = useArtist(artwork.artist_id);
  const { data: location, isLoading: locationLoading } = useLocation(artwork.location_id);
  
  const {
    documents,
    handleDownloadAllFiles,
    handleDownloadSingleFile,
    handleDownloadAllImages
  } = useFileOperations(
    artwork.id, 
    artist?.full_name || 'Unknown_Artist', 
    artwork.title
  );

  const handleDialogInteraction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    onOpenChange(newOpen); 
  }, [onOpenChange]);

  const handleGeneratePDF = useCallback(() => { // useStationery is always true for artworks
    if (isGenerating) return;
    
    setIsGenerating(true);
    createArtworkPDF(artwork, true) // Pass true for useStationery
      .then(() => {
        // createArtworkPDF handles success toast
      })
      .catch((error) => {
        console.error("Error generating PDF:", error);
        toast.error("Failed to generate PDF");
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [artwork, isGenerating]); // Dependencies for useCallback

  // useEffect to skip PDF preview dialog
  useEffect(() => {
    if (pdfPreviewOpen) {
      // Directly generate PDF when `setPDFPreviewOpen(true)` is called by DialogHeaderActions
      handleGeneratePDF();
      setPDFPreviewOpen(false); // Reset immediately
    }
  }, [pdfPreviewOpen, handleGeneratePDF, setPDFPreviewOpen]);


  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="max-w-4xl w-[90vw] md:w-full max-h-[90vh] overflow-hidden flex flex-col p-0"
          onClick={handleDialogInteraction}
        >
          <DialogHeader className="p-6 pb-2 sticky top-0 bg-background z-10 border-b">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-2xl font-semibold">
                {artwork.title}
              </DialogTitle>
              <DialogHeaderActions
                isGenerating={isGenerating}
                // setPDFPreviewOpen will trigger the useEffect hook above
                setPDFPreviewOpen={setPDFPreviewOpen} 
                handleDownloadAllImages={handleDownloadAllImages}
                documents={documents}
                handleDownloadAllFiles={handleDownloadAllFiles}
                handleDownloadSingleFile={handleDownloadSingleFile}
                showCreatePdf={true}
                showDownloadFiles={true}
                showDownloadAllImages={true}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mb-6">
              <ArtworkCarousel 
                artworkId={artwork.id} 
                artistName={artist?.full_name || "Unknown_Artist"} 
                artworkTitle={artwork.title} 
              />
            </div>
            
            <div className="px-6 pb-6 space-y-6">
              <ArtworkOverviewPrimaryInfo 
                artwork={artwork} 
                artist={artist} 
                artistLoading={artistLoading} 
              />
              <ArtworkOverviewCollapsibleInfo 
                artwork={artwork} 
                location={location}
                locationLoading={locationLoading}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* PDFPreviewDialog is no longer rendered here to skip the preview step */}
    </>
  );
}

