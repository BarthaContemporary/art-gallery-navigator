import { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtist } from "@/hooks/use-artist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { PDFPreviewDialog } from "../pdf/PDFPreviewDialog";
import { ArtworkPDFPreview } from "../pdf/ArtworkPreview";
import { ArtworkCarousel } from "./ArtworkCarousel";
import { ArtworkDetailsSection } from "./overview/ArtworkDetailsSection";
import { DimensionsSection } from "./overview/DimensionsSection";
import { AdditionalInfoSection } from "./overview/AdditionalInfoSection";

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-center relative">
              <DialogTitle className="text-2xl font-bold">
                {artwork.title}
              </DialogTitle>
              <Button
                variant="outline"
                className="flex items-center gap-2 absolute right-8"
                onClick={() => setPDFPreviewOpen(true)}
                disabled={isGenerating}
              >
                <Save className="h-4 w-4" />
                {isGenerating ? "Creating PDF..." : "Create PDF"}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="mb-8">
              <ArtworkCarousel artworkId={artwork.id} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6">
              <div className="space-y-8">
                <ArtworkDetailsSection artwork={artwork} artist={artist} artistLoading={artistLoading} />
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
