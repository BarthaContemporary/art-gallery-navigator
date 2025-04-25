
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
    <div className="space-y-4">
      {/* PDF Generation Button in separate box */}
      <div className="bg-white p-4 shadow rounded-lg">
        <Button 
          onClick={onGeneratePDF}
          disabled={!collection || isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90"
        >
          {isGenerating ? "Generating..." : "Save as PDF"}
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Container with shorter right padding */}
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
              
              {/* Main Content Area with reduced right padding */}
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
