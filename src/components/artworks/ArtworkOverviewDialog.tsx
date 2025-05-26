
import React, { useState, useCallback, useEffect } from "react";
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

  const handleGeneratePDF = useCallback(() => { 
    if (isGenerating) return;
    
    setIsGenerating(true);
    createArtworkPDF(artwork, true)
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
  }, [artwork, isGenerating]);

  useEffect(() => {
    if (pdfPreviewOpen) {
      handleGeneratePDF();
      setPDFPreviewOpen(false); 
    }
  }, [pdfPreviewOpen, handleGeneratePDF, setPDFPreviewOpen]);


  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="max-w-4xl w-[90vw] md:w-full max-h-[90vh] overflow-hidden flex flex-col p-0"
          onClick={handleDialogInteraction}
        >
          <DialogHeader className="p-6 pb-2 pt-10 sticky top-0 bg-background z-10 border-b">
            <div className="flex flex-col items-start gap-3 md:flex-row md:justify-between md:items-center md:gap-0">
              <DialogTitle className="text-2xl font-semibold text-left">
                {artwork.title}
              </DialogTitle>
              <DialogHeaderActions
                isGenerating={isGenerating}
                setPDFPreviewOpen={setPDFPreviewOpen} 
                handleDownloadAllImages={handleDownloadAllImages}
                documents={documents}
                handleDownloadAllFiles={handleDownloadAllFiles}
                handleDownloadSingleFile={handleDownloadSingleFile}
                showCreatePdf={true}
                showDownloadFiles={false}
                showDownloadAllImages={true}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mb-6 px-6 pt-6"> 
              <ArtworkCarousel 
                artworkId={artwork.id} 
                artistName={artist?.full_name || "Unknown_Artist"} 
                artworkTitle={artwork.title}
                isDialogActive={open}
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
    </>
  );
}
