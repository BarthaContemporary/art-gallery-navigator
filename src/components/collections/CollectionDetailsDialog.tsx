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

  const { scrollToTop, scrollContainerRef } = useScrollableDialog(open, {
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
      <ScrollableDialogContent size="4xl" className="p-0">
        <ScrollableDialogHeader className="px-8 pt-8 pb-0">
          <ScrollableDialogTitle className="text-2xl font-bold text-foreground">
            {collection.name}
          </ScrollableDialogTitle>
          {collection.description && (
            <ScrollableDialogDescription className="text-base text-muted-foreground mt-2">
              {collection.description}
            </ScrollableDialogDescription>
          )}
        </ScrollableDialogHeader>
        
        <ScrollableDialogBody className="flex-1 min-h-0 px-8 pb-8" ref={scrollContainerRef}>
          <div className="space-y-8">
            {/* Action Buttons */}
            <div className="pt-6 border-t border-border/50">
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
            </div>

            {/* Collection Content */}
            <div className="space-y-8">
              {/* Artworks Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-primary rounded-full"></div>
                  <h3 className="text-xl font-semibold text-foreground">Artworks</h3>
                  <div className="h-px bg-border/50 flex-1"></div>
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {collection.artworks?.length || 0} {collection.artworks?.length === 1 ? 'artwork' : 'artworks'}
                  </span>
                </div>
                <div className="animate-fade-in">
                  <CollectionDialogArtworksList
                    artworks={collection.artworks}
                    getArtistName={getArtistName}
                  />
                </div>
              </div>

              {/* Documents Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-primary rounded-full"></div>
                  <h3 className="text-xl font-semibold text-foreground">Documents</h3>
                  <div className="h-px bg-border/50 flex-1"></div>
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {documents?.length || 0} {documents?.length === 1 ? 'document' : 'documents'}
                  </span>
                </div>
                <div className="animate-fade-in">
                  <CollectionDialogDocumentsList
                    documents={documents}
                    onDownloadDocument={handleDocumentDownload}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}
