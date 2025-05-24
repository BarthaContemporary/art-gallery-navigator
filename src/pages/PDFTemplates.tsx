
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useArtworks } from "@/hooks/use-artworks";
import { useCollections } from "@/hooks/use-collections";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { toast } from "sonner";
import { ArtworkPreviewPanel } from "@/components/pdf/ArtworkPreviewPanel";
import { CollectionPreviewPanel } from "@/components/pdf/CollectionPreviewPanel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function PDFTemplates() {
  const { type, id } = useParams();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("classic");
  const [useStationery, setUseStationery] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New PDF feature options
  const [addPageNumbers, setAddPageNumbers] = useState<boolean>(true);
  const [addTimeStamp, setAddTimeStamp] = useState<boolean>(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
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
        // For artworks, useStationery is effectively always true for PDF generation
        await createArtworkPDF(artwork, true, {
          addPageNumbers,
          addTimeStamp,
          orientation
        });
        toast.success("Artwork PDF created successfully");
      } else if (collection) {
        await createCollectionPDF(collection, selectedTemplate, useStationery, {
          addPageNumbers,
          addTimeStamp,
          orientation
        });
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div>
          <p className="text-muted-foreground">Generate PDF documents for artworks and collections</p>
        </div>
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
              {type === "artwork" 
                ? "Preview the artwork PDF. Stationery is always used for generated artwork PDFs." 
                : "Select a template style and stationery option"}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="stationery-mode-page"
              checked={useStationery}
              onCheckedChange={setUseStationery}
              disabled={type === "artwork"} // Disable if artwork preview always shows stationery
            />
            <Label htmlFor="stationery-mode-page">
              {type === "artwork" 
                ? "Stationery Preview (PDF always includes)" 
                : "Use Company Stationery"}
            </Label>
          </div>
        </div>
        
        {/* New PDF Options Section */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium mb-3">PDF Options</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="add-page-numbers" 
                checked={addPageNumbers}
                onCheckedChange={(checked) => setAddPageNumbers(checked === true)}
              />
              <Label htmlFor="add-page-numbers">Add Page Numbers</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="add-timestamp" 
                checked={addTimeStamp}
                onCheckedChange={(checked) => setAddTimeStamp(checked === true)}
              />
              <Label htmlFor="add-timestamp">Add Generation Timestamp</Label>
            </div>
            
            <div>
              <Label className="mb-2 block">Page Orientation</Label>
              <RadioGroup 
                value={orientation} 
                onValueChange={(value) => setOrientation(value as 'portrait' | 'landscape')}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="portrait" id="portrait" />
                  <Label htmlFor="portrait">Portrait</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="landscape" id="landscape" />
                  <Label htmlFor="landscape">Landscape</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
        
        {/* Preview Panels */}
        {type === "artwork" ? (
          <ArtworkPreviewPanel
            artwork={artwork}
            selectedTemplate={selectedTemplate}
            useStationery={useStationery}
            isGenerating={isGenerating}
            onTemplateChange={setSelectedTemplate}
            onGeneratePDF={handleGeneratePDF}
          />
        ) : type === "collection" && collection ? (
          <CollectionPreviewPanel
            collection={collection}
            isGenerating={isGenerating}
            onGeneratePDF={handleGeneratePDF}
          />
        ) : (
          <p>Select an artwork or collection to preview.</p>
        )}
      </div>
    </div>
  );
}
