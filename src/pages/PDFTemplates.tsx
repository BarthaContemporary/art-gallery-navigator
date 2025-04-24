
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useArtworks } from "@/hooks/use-artworks";
import { useCollections } from "@/hooks/use-collections";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";
import { ArtworkPreviewPanel } from "@/components/pdf/ArtworkPreviewPanel";
import { CollectionPreviewPanel } from "@/components/pdf/CollectionPreviewPanel";

export default function PDFTemplates() {
  const { type, id } = useParams();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("classic");
  const [useStationery, setUseStationery] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: artworks } = useArtworks();
  const { data: collections } = useCollections();
  
  const artwork = type === "artwork" && id ? 
    artworks?.find(a => a.id === id) : undefined;
    
  const collection = type === "collection" && id ?
    collections?.find(c => c.id === id) : undefined;
    
  const handleGeneratePDF = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      if (artwork) {
        await createArtworkPDF(artwork, selectedTemplate, useStationery);
        toast.success("Artwork PDF created successfully");
      } else if (collection) {
        await createCollectionPDF(collection, selectedTemplate, useStationery);
        toast.success("Collection PDF created successfully");
      } else {
        toast.error("No item selected to create PDF");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pt-6 pb-6 px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">PDF Templates</h1>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-medium">
              {type === "artwork" && artwork 
                ? `Artwork: ${artwork.title}`
                : type === "collection" && collection
                ? `Collection: ${collection.name}`
                : "PDF Template Preview"
              }
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a template style and stationery option
            </p>
          </div>
        </div>
        
        {type === "artwork" ? (
          <ArtworkPreviewPanel
            artwork={artwork}
            selectedTemplate={selectedTemplate}
            useStationery={useStationery}
            isGenerating={isGenerating}
            onTemplateChange={setSelectedTemplate}
            onStationeryChange={setUseStationery}
            onGeneratePDF={handleGeneratePDF}
          />
        ) : (
          <CollectionPreviewPanel
            collection={collection}
            isGenerating={isGenerating}
            onGeneratePDF={handleGeneratePDF}
          />
        )}
      </div>
    </div>
  );
}
