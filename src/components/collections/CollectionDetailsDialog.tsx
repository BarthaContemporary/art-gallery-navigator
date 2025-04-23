
import { Collection } from "@/hooks/use-collections";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";

interface CollectionDetailsDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionDetailsDialog({
  collection,
  open,
  onOpenChange,
}: CollectionDetailsDialogProps) {
  const handleDownloadPDF = async () => {
    try {
      toast.promise(createCollectionPDF(collection), {
        loading: "Generating PDF...",
        success: "PDF ready for download",
        error: "Failed to generate PDF",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex justify-between">
          <DialogTitle className="text-xl">{collection.name}</DialogTitle>
          <Button 
            variant="outline" 
            className="flex items-center gap-2" 
            onClick={handleDownloadPDF}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </DialogHeader>
        {collection.description && (
          <p className="text-muted-foreground">{collection.description}</p>
        )}

        <div className="text-base font-medium mt-2">
          Artworks in this collection:
        </div>

        {collection.artworks?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No artworks in this collection</p>
        ) : (
          <ScrollArea className="flex-1 mt-2 pr-4">
            <div className="grid grid-cols-1 gap-4">
              {collection.artworks?.map((artwork) => (
                <Card key={artwork.id} className="overflow-hidden">
                  <div className="flex">
                    <div className="w-24 h-24 shrink-0">
                      <img
                        src={artwork.image_url || "/placeholder.svg"}
                        alt={artwork.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium">{artwork.title}</h3>
                      {artwork.year && <p className="text-sm">Year: {artwork.year}</p>}
                      {artwork.medium_type && (
                        <p className="text-xs text-muted-foreground">Medium: {artwork.medium_type}</p>
                      )}
                      {artwork.materials && (
                        <p className="text-xs text-muted-foreground">{artwork.materials}</p>
                      )}
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
