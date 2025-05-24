
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collection } from "@/hooks/use-collections";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
import { useState } from "react";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";
import { useArtists } from "@/components/artworks/form/useArtists";
import { useCreateCollectionWebsite } from "@/hooks/collection-websites";
import { CollectionDialogActions } from "./CollectionDialogActions";
import { CollectionDialogArtworksList } from "./CollectionDialogArtworksList";
import { CollectionDialogDocumentsList } from "./CollectionDialogDocumentsList";

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCreatingWebsite, setIsCreatingWebsite] = useState(false);

  const createCollectionWebsiteMutation = useCreateCollectionWebsite();

  const handleDocumentDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllDocuments = () => {
    documents?.forEach(doc => {
      handleDocumentDownload(doc.file_url, doc.file_name);
    });
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      if (collection) {
        await createCollectionPDF(collection, "classic", true);
        toast.success("Collection PDF created successfully");
      } else {
        toast.error("No collection selected to create PDF");
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getArtistName = (artistId: string | null) => {
    if (!artistId || !artists) return "Unknown Artist";
    const artist = artists.find(a => a.id === artistId);
    return artist ? artist.full_name : "Unknown Artist";
  };

  const handleCreateWebsite = async () => {
    if (!collection) {
      toast.error("No collection selected to create a website for.");
      return;
    }
    setIsCreatingWebsite(true);
    try {
      const newWebsite = await createCollectionWebsiteMutation.mutateAsync({
        collection_id: collection.id,
        collection_name: collection.name,
      });
      toast.success(`Website "${newWebsite.name || newWebsite.slug}" created successfully!`);
    } catch (error) {
      console.error('Error creating website:', error);
      toast.error("Failed to create website. Please try again.");
    } finally {
      setIsCreatingWebsite(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="text-2xl font-semibold">{collection.name}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {collection.description}
        </DialogDescription>

        <div className="space-y-6 pt-4">
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
      </DialogContent>
    </Dialog>
  );
}
