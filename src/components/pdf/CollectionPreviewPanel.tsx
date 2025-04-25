
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Collection } from "@/hooks/use-collections";
import { CollectionPDFPreview } from "@/components/pdf/CollectionPreview";

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
  return (
    <div>
      <div className="bg-gray-100 p-6 rounded-lg">
        {/* Preview Container */}
        <div className="mx-auto relative" style={{ width: '595px', height: '842px' }}>
          {/* PDF Generation Button - Positioned absolutely on top */}
          <div className="absolute -top-2 right-0 z-[100]">
            <Button 
              onClick={onGeneratePDF}
              disabled={!collection || isGenerating}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              {isGenerating ? "Generating..." : "Save as PDF"}
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* PDF Preview Area */}
          <div className="bg-white shadow-lg h-full relative">
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
              <div className="pt-[8cm] pl-[4cm] pr-[3cm] pb-[3.5cm] h-full overflow-auto relative">
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
