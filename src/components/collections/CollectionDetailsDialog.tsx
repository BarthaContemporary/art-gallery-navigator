import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { CollectionPDFPreview } from "@/components/pdf/CollectionPreview";
import { useState } from "react";
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
  const { data: documents } = useCollectionDocuments(collection?.id);
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
      setIsGenerating(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <div className="space-y-4">
          {/* PDF Generation Buttons */}
          <div className="bg-white p-4 shadow rounded-lg">
            <div className="flex gap-4">
              <Button 
                onClick={handleGeneratePDF}
                disabled={!collection || isGenerating}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90"
              >
                {isGenerating ? "Generating..." : "Create Artworks PDF"}
                <Download className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    className="flex-1 flex items-center justify-center gap-2"
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
                  )}
                  {!documents?.length && (
                    <DropdownMenuItem disabled>
                      No documents available
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Preview Container */}
          <div className="bg-white p-6 shadow rounded-lg">
            <div className="mx-auto relative" style={{ width: '595px', height: '842px' }}>
              {/* PDF Preview Area */}
              <div className="bg-white h-full relative">
                {/* Stationery Background */}
                <div className="absolute inset-0">
                  <img 
                    src="/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png"
                    alt="Bartha Contemporary Stationery"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Content Container */}
                <div className="relative h-full">
                  {/* Collection Name Header */}
                  <div className="absolute top-[6cm] left-[4cm] font-bold text-[10px]">
                    {collection ? collection.name : "Collection Name"}
                  </div>
                  
                  {/* Main Content Area */}
                  <div className="pt-[8cm] pl-[4cm] pr-[2cm] pb-[3.5cm] h-full overflow-auto relative">
                    <div className="relative">
                      <CollectionPDFPreview collection={collection} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
