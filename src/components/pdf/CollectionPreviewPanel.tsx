
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Collection } from "@/hooks/use-collections";
import { CollectionPDFPreview } from "@/lib/pdf-templates";

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
      <div className="bg-gray-100 p-6 rounded-lg relative">
        <Button 
          onClick={onGeneratePDF}
          disabled={!collection || isGenerating}
          className="absolute top-4 right-4 z-10 flex items-center gap-2"
        >
          {isGenerating ? "Generating..." : "Save as PDF"}
          <Download className="h-4 w-4" />
        </Button>
        
        <div className="mx-auto" style={{ width: '595px', height: '842px', position: 'relative' }}>
          <div className="bg-white shadow-lg h-full overflow-auto">
            <div className="absolute inset-0 pointer-events-none">
              <img 
                src="/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png"
                alt="Bartha Contemporary Stationery"
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="pt-[8cm] pl-[4cm] pr-[3cm] pb-[3.5cm] h-full overflow-auto">
              <div className="absolute top-[6cm] left-[4cm] font-bold text-[10px]">
                {collection ? collection.name : "Collection Name"}
              </div>
              
              {collection && <CollectionPDFPreview collection={collection} />}
              {!collection && (
                <p className="text-[10px]">No collection selected to preview</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
