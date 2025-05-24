
import React, { useState, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
import { useLocation } from "@/hooks/use-location"; // For fetching location data
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { toast } from "sonner";
import { PDFPreviewDialog } from "../pdf/PDFPreviewDialog";
import { ArtworkPDFPreview } from "../pdf/ArtworkPreview";
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
  const { data: location, isLoading: locationLoading } = useLocation(artwork.location_id); // Fetch location
  
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
    onOpenChange(newOpen); // Simplified, as Radix handles focus and state well
  }, [onOpenChange]);

  const handleGeneratePDF = (templateStyle: string, useStationery: boolean) => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    createArtworkPDF(artwork, templateStyle, useStationery)
      .then(() => {
        // Success is handled by the PDF generator
      })
      .catch((error) => {
        console.error("Error generating PDF:", error);
        toast.error("Failed to generate PDF");
      })
      .finally(() => {
        setIsGenerating(false);
      });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="max-w-4xl w-[90vw] md:w-full max-h-[90vh] overflow-hidden flex flex-col p-0" // Changed padding to p-0
          onClick={handleDialogInteraction} // Keep this to prevent card click through if dialog is nested weirdly
        >
          <DialogHeader className="p-6 pb-2 sticky top-0 bg-background z-10 border-b"> {/* Added padding, sticky, bg, border */}
            <div className="flex justify-between items-center"> {/* Removed 'relative' from here */}
              <DialogTitle className="text-2xl font-semibold"> {/* Adjusted font-bold to font-semibold */}
                {artwork.title}
              </DialogTitle>
              {/* Ensure DialogHeaderActions is positioned by its parent or flex layout */}
              <DialogHeaderActions
                isGenerating={isGenerating}
                setPDFPreviewOpen={setPDFPreviewOpen}
                handleDownloadAllImages={handleDownloadAllImages}
                documents={documents}
                handleDownloadAllFiles={handleDownloadAllFiles}
                handleDownloadSingleFile={handleDownloadSingleFile}
                showCreatePdf={false}
                showDownloadFiles={false}
                showDownloadAllImages={false}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto"> {/* Ensure this part scrolls */}
            <div className="mb-6"> {/* Margin for carousel */}
              <ArtworkCarousel 
                artworkId={artwork.id} 
                artistName={artist?.full_name || "Unknown_Artist"} 
                artworkTitle={artwork.title} 
              />
            </div>
            
            <div className="px-6 pb-6 space-y-6"> {/* Padding for content area, space between sections */}
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
      
      <PDFPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPDFPreviewOpen}
        onApply={handleGeneratePDF}
        title={artwork.title}
        content={<ArtworkPDFPreview artwork={artwork} templateStyle="basic" />}
        type="artwork"
      />
    </>
  );
}
