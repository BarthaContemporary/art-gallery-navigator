
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
import { Download, Save } from "lucide-react";
import { PDFPreviewDialog } from "../pdf/PDFPreviewDialog";
import { ArtworkPDFPreview } from "../pdf/ArtworkPreview";
import { ArtworkCarousel } from "./ArtworkCarousel";

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
  const { data: artist } = useArtist(artwork.artist_id);
  
  const handleGeneratePDF = (templateStyle: string, useStationery: boolean) => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    createArtworkPDF(artwork, templateStyle, useStationery)
      .then(() => {
        // Success handling is done by the PDF generator
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
            <div className="flex justify-between items-center">
              <DialogTitle className="text-2xl font-bold">
                {artwork.title}
                {artwork.year ? ` (${artwork.year})` : ""}
              </DialogTitle>
              <Button
                variant="outline"
                className="flex items-center gap-2"
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
              <div>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Artist</dt>
                    <dd className="text-lg">{artist?.full_name || "Unknown Artist"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Year</dt>
                    <dd>{artwork.year || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Medium Type</dt>
                    <dd>{artwork.medium_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Materials</dt>
                    <dd>{artwork.materials || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Dimensions</dt>
                    <dd>{artwork.dimensions || "Not specified"}</dd>
                  </div>
                </dl>
              </div>
              
              <div>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                    <dd>{artwork.status || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Price</dt>
                    <dd>
                      {artwork.price
                        ? `${artwork.currency} ${artwork.price.toLocaleString()}`
                        : "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Classification</dt>
                    <dd>{artwork.classification}</dd>
                  </div>
                  {artwork.classification !== "Unique" && (
                    <>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Edition Size</dt>
                        <dd>{artwork.edition_size || "Not specified"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Available Works</dt>
                        <dd>{artwork.available_works || "Not specified"}</dd>
                      </div>
                    </>
                  )}
                </dl>
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
