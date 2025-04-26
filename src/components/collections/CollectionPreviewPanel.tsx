import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Collection } from "@/hooks/use-collections";
import { CollectionPDFPreview } from "@/components/pdf/CollectionPreview";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CollectionPreviewPanelProps {
  collection: Collection | undefined;
  isGenerating: boolean;
  onGeneratePDF: () => void;
}

export function CollectionPreviewPanel({
  collection,
  isGenerating,
  onGeneratePDF
}: CollectionPreviewPanelProps) {
  const { data: documents } = useCollectionDocuments(collection?.id);

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

  return (
    <div className="space-y-4">
      {/* PDF Generation Buttons in separate box */}
      <div className="bg-white p-4 shadow rounded-lg">
        <div className="flex gap-4">
          <Button 
            onClick={onGeneratePDF}
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
              ))}
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
                src="/lovable-uploads/daab986c-42d2-4558-97df-8b286b5cb911.png"
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
                  {collection && <CollectionPDFPreview collection={collection} />}
                  {!collection && (
                    <p className="text-[10px]">No collection selected to preview</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
