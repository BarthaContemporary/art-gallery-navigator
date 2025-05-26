
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collection } from "@/hooks/use-collections";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
import { useArtists } from "@/hooks/useArtists"; // Corrected import path
import { useCreateCollectionWebsite } from "@/hooks/collection-websites";
import { CollectionDialogActions } from "./CollectionDialogActions";
import { CollectionDialogArtworksList } from "./CollectionDialogArtworksList";
import { CollectionDialogDocumentsList } from "./CollectionDialogDocumentsList";
import { useCollectionDialogState } from "@/hooks/useCollectionDialogState"; // Import the new hook
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

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
  const { data: documents } = useCollectionDocuments(collection?.id);
  const { data: artists } = useArtists(); // This hook fetches artists
  const createCollectionWebsiteMutation = useCreateCollectionWebsite();

  const {
    isGeneratingPDF,
    isCreatingWebsite,
    handleDocumentDownload,
    handleDownloadAllDocuments,
    handleGeneratePDF,
    getArtistName,
    handleCreateWebsite,
  } = useCollectionDialogState({
    collection,
    documents,
    artists, // artists here should be Artist[] | undefined
    createCollectionWebsiteMutation,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col max-h-[90vh]">
        <DialogTitle className="text-2xl font-semibold pt-6 px-6"> {/* Added padding to match other dialogs if header isn't sticky */}
          {collection.name}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground px-6">
          {collection.description}
        </DialogDescription>

        <ScrollArea className="flex-grow px-6 py-4"> {/* Wrap content in ScrollArea */}
          <div className="space-y-6">
            {/* Top buttons */}
            <CollectionDialogActions
              collection={collection}
              isGeneratingPDF={isGeneratingPDF}
              onGeneratePDF={handleGeneratePDF}
              documents={documents}
              onDownloadDocument={handleDocumentDownload}
              onDownloadAllDocuments={handleDownloadAllDocuments}
              isCreatingWebsite={isCreatingWebsite}
              onCreateWebsite={handleCreateWebsite}
            />

            {/* Collection Content */}
            <div className="space-y-6">
              {/* Artworks List */}
              <div>
                <h3 className="text-lg font-medium mb-3">Artworks</h3>
                <CollectionDialogArtworksList
                  artworks={collection.artworks}
                  getArtistName={getArtistName} // This function uses the artists data
                />
              </div>

              {/* Documents List */}
              <div>
                <h3 className="text-lg font-medium mb-3">Documents</h3>
                <CollectionDialogDocumentsList
                  documents={documents}
                  onDownloadDocument={handleDocumentDownload}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
