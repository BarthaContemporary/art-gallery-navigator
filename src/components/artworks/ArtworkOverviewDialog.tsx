import { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { PDFPreviewDialog } from "../pdf/PDFPreviewDialog";
import { ArtworkPDFPreview } from "../pdf/ArtworkPreview";

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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle className="text-xl">
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
            <DialogDescription>
              Overview of artwork details and information
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <div className="w-full h-64 overflow-hidden rounded-md">
                  <img
                    src={artwork.image_url || "/placeholder.svg"}
                    alt={artwork.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Uploaded on{" "}
                  {new Date().toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>

              <div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Title</h4>
                    <p className="text-sm text-muted-foreground">{artwork.title}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">
                      Year
                    </h4>
                    <p className="text-sm text-muted-foreground">{artwork.year}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Medium</h4>
                    <p className="text-sm text-muted-foreground">{artwork.medium_type}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Materials</h4>
                    <p className="text-sm text-muted-foreground">{artwork.materials}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Dimensions</h4>
                    <p className="text-sm text-muted-foreground">{artwork.dimensions}</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Price</h4>
                    <p className="text-sm text-muted-foreground">
                      {artwork.price} {artwork.currency}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Status</h4>
                    <p className="text-sm text-muted-foreground">{artwork.status}</p>
                  </div>
                </div>
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
