
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collection } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";
import { useArtists } from "@/components/artworks/form/useArtists";

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
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDocumentDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    documents?.forEach(doc => {
      handleDocumentDownload(doc.file_url, doc.file_name);
    });
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
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
      setIsGenerating(false);
    }
  };

  // Function to get artist name from artist_id
  const getArtistName = (artistId: string | null) => {
    if (!artistId || !artists) return "Unknown Artist";
    const artist = artists.find(a => a.id === artistId);
    return artist ? artist.full_name : "Unknown Artist";
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
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleGeneratePDF}
              disabled={!collection || isGenerating}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              {isGenerating ? "Generating..." : "Create Artworks PDF"}
              <Download className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  className="flex items-center gap-2"
                  disabled={!documents?.length}
                >
                  Download Documents
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {documents?.length > 0 && (
                  <>
                    <DropdownMenuItem onClick={handleDownloadAll}>
                      Download All Documents
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {documents?.map((doc) => (
                  <DropdownMenuItem
                    key={doc.id}
                    onClick={() => handleDocumentDownload(doc.file_url, doc.file_name)}
                  >
                    {doc.file_name}
                  </DropdownMenuItem>
                ))}
                {!documents?.length && (
                  <DropdownMenuItem disabled>
                    No documents available
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Collection Content */}
          <div className="space-y-6">
            {/* Artworks List */}
            <div>
              <h3 className="text-lg font-medium mb-3">Artworks</h3>
              <div className="border rounded-lg divide-y">
                {collection.artworks?.map((artwork) => (
                  <div key={artwork.id} className="p-4">
                    <h4 className="font-medium">{artwork.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getArtistName(artwork.artist_id)} • {artwork.year}
                    </p>
                  </div>
                ))}
                {(!collection.artworks || collection.artworks.length === 0) && (
                  <p className="p-4 text-muted-foreground">No artworks in this collection</p>
                )}
              </div>
            </div>

            {/* Documents List */}
            <div>
              <h3 className="text-lg font-medium mb-3">Documents</h3>
              <div className="border rounded-lg divide-y">
                {documents?.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between">
                    <span>{doc.file_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDocumentDownload(doc.file_url, doc.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!documents || documents.length === 0) && (
                  <p className="p-4 text-muted-foreground">No documents attached</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
