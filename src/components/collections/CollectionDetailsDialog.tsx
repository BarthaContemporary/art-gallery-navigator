import { Collection } from "@/hooks/use-collections";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, FileText } from "lucide-react";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";
import { useState } from "react";
import { PDFPreviewDialog } from "@/components/pdf/PDFPreviewDialog";
import { CollectionPDFPreview } from "@/components/pdf/CollectionPreview";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
interface CollectionDetailsDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function CollectionDetailsDialog({
  collection,
  open,
  onOpenChange
}: CollectionDetailsDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfPreviewOpen, setPDFPreviewOpen] = useState(false);
  const {
    data: documents,
    isLoading: isLoadingDocuments
  } = useCollectionDocuments(collection.id);
  const handleGeneratePDF = (templateStyle: string, useStationery: boolean) => {
    if (isGenerating) return;
    setIsGenerating(true);
    createCollectionPDF(collection, templateStyle, useStationery).then(() => {
      // Success is handled by the PDF generator
    }).catch(error => {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }).finally(() => {
      setIsGenerating(false);
    });
  };
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex justify-between">
            <div>
              <DialogTitle className="text-xl">{collection.name}</DialogTitle>
              <DialogDescription>Collection overview and artwork list</DialogDescription>
            </div>
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setPDFPreviewOpen(true)} disabled={isGenerating}>
              <Save className="h-4 w-4" />
              {isGenerating ? "Creating PDF..." : "Create PDF"}
            </Button>
          </DialogHeader>
          {collection.description && <p className="text-muted-foreground">{collection.description}</p>}

          <div className="text-base font-medium mt-2">
            Artworks in this collection:
          </div>

          {collection.artworks?.length === 0 ? <p className="text-sm text-muted-foreground">No artworks in this collection</p> : <ScrollArea className="flex-1 mt-2 pr-4">
              <div className="grid grid-cols-1 gap-4">
                {collection.artworks?.map(artwork => <Card key={artwork.id} className="overflow-hidden">
                    <div className="flex">
                      <div className="w-24 h-24 shrink-0">
                        <img src={artwork.image_url || "/placeholder.svg"} alt={artwork.title} className="w-full h-full object-cover" />
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium">{artwork.title}</h3>
                        {artwork.year && <p className="text-sm">Year: {artwork.year}</p>}
                        {artwork.medium_type && <p className="text-xs text-muted-foreground">Medium: {artwork.medium_type}</p>}
                        {artwork.materials && <p className="text-xs text-muted-foreground">{artwork.materials}</p>}
                      </CardContent>
                    </div>
                  </Card>)}
              </div>
            </ScrollArea>}

          <div className="text-base font-medium mt-4">
            Related Documents:
          </div>

          {isLoadingDocuments ? <p className="text-sm text-muted-foreground">Loading documents...</p> : documents?.length === 0 ? <p className="text-sm text-muted-foreground">No documents attached to this collection</p> : <ScrollArea className="mt-2 pr-4 max-h-[200px]">
              <div className="grid grid-cols-1 gap-2">
                {documents?.map(doc => <Card key={doc.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.file_name}</p>
                        {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                      </div>
                    </CardContent>
                  </Card>)}
              </div>
            </ScrollArea>}
        </DialogContent>
      </Dialog>
      
      <PDFPreviewDialog open={pdfPreviewOpen} onOpenChange={setPDFPreviewOpen} onApply={handleGeneratePDF} title={collection.name} content={<CollectionPDFPreview collection={collection} />} type="collection" />
    </>;
}