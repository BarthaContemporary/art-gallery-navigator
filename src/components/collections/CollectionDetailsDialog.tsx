
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
  ScrollableDialogHeader,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { Collection } from "@/hooks/use-collections";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
import { useArtists } from "@/hooks/useArtists";
import { useCreateCollectionWebsite } from "@/hooks/collection-websites";
import { CollectionDialogActions } from "./CollectionDialogActions";
import { CollectionDialogArtworksList } from "./CollectionDialogArtworksList";
import { CollectionDialogDocumentsList } from "./CollectionDialogDocumentsList";
import { useCollectionDialogState } from "@/hooks/useCollectionDialogState";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

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
  const { data: artists } = useArtists();
  const createCollectionWebsiteMutation = useCreateCollectionWebsite();

  const { scrollToTop } = useScrollableDialog(open, {
    enableKeyboardNavigation: true
  });

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
    artists,
    createCollectionWebsiteMutation,
  });

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent size="4xl">
        <ScrollableDialogHeader>
          <ScrollableDialogTitle className="text-2xl font-semibold">
            {collection.name}
          </ScrollableDialogTitle>
          <ScrollableDialogDescription className="text-sm text-muted-foreground">
            {collection.description}
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
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
                  getArtistName={getArtistName}
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
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
