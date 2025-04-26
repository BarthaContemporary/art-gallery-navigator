
import React, { useState, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
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
import { ArtworkDetailsSection } from "./overview/ArtworkDetailsSection";
import { DimensionsSection } from "./overview/DimensionsSection";
import { AdditionalInfoSection } from "./overview/AdditionalInfoSection";
import { useNavigate } from "react-router-dom";
import { DialogHeaderActions } from "./overview/DialogHeaderActions";
import { useFileOperations } from "./overview/useFileOperations";

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
  const navigate = useNavigate();
  
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

  // Use a memoized handler to prevent re-renders and event propagation issues
  const handleDialogInteraction = useCallback((e: React.MouseEvent) => {
    // Prevent event from bubbling up to parent elements
    e.stopPropagation();
  }, []);

  // Safer dialog close handler
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Add a small delay to ensure clean state transition
      setTimeout(() => {
        onOpenChange(false);
      }, 10);
    } else {
      onOpenChange(true);
    }
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
          className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={handleDialogInteraction}
        >
          <DialogHeader>
            <div className="flex justify-between items-center relative">
              <DialogTitle className="text-2xl font-bold">
                {artwork.title}
              </DialogTitle>
              <DialogHeaderActions
                isGenerating={isGenerating}
                setPDFPreviewOpen={setPDFPreviewOpen}
                handleDownloadAllImages={handleDownloadAllImages}
                documents={documents}
                handleDownloadAllFiles={handleDownloadAllFiles}
                handleDownloadSingleFile={handleDownloadSingleFile}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="mb-8">
              <ArtworkCarousel 
                artworkId={artwork.id} 
                artistName={artist?.full_name || "Unknown_Artist"} 
                artworkTitle={artwork.title} 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6">
              <div className="space-y-8">
                <ArtworkDetailsSection 
                  artwork={artwork} 
                  artist={artist} 
                  artistLoading={artistLoading} 
                />
                <DimensionsSection artwork={artwork} />
              </div>
              <div>
                <AdditionalInfoSection artwork={artwork} />
              </div>
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
