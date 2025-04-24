
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useParams } from "react-router-dom";
import { useArtworks } from "@/hooks/use-artworks";
import { useCollections } from "@/hooks/use-collections";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { createCollectionPDF } from "@/lib/create-collection-pdf";
import { ArtworkPDFPreview, CollectionPDFPreview } from "@/lib/pdf-templates";
import { toast } from "sonner";
import { Download } from "lucide-react";

export default function PDFTemplates() {
  const { type, id } = useParams();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("classic");
  const [useStationery, setUseStationery] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: artworks } = useArtworks();
  const { data: collections } = useCollections();
  
  // Get the entity based on the type and ID
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
          
          {/* Only show stationery switch for artwork PDFs */}
          {type === "artwork" && (
            <div className="flex items-center space-x-2">
              <Switch
                id="stationery-mode"
                checked={useStationery}
                onCheckedChange={setUseStationery}
              />
              <Label htmlFor="stationery-mode">Use Company Stationery</Label>
            </div>
          )}
          
          {/* For collections, stationery is always on */}
          {type === "collection" && (
            <Button 
              onClick={handleGeneratePDF}
              disabled={!collection || isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? "Generating..." : "Export PDF"}
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {type === "artwork" ? (
          <Tabs defaultValue="classic" value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <TabsList className="grid grid-cols-3 mb-6 w-full max-w-md mx-auto">
              <TabsTrigger value="classic">Classic</TabsTrigger>
              <TabsTrigger value="modern">Modern</TabsTrigger>
              <TabsTrigger value="minimal">Minimal</TabsTrigger>
            </TabsList>
            
            <div className="bg-gray-100 p-6 rounded-lg">
              <div className="mx-auto" style={{ width: '595px', height: '842px', position: 'relative' }}>
                {/* A4 container (595x842 pixels @ 72dpi) */}
                <div className="bg-white shadow-lg h-full overflow-auto">
                  {useStationery && (
                    <div className="absolute inset-0 pointer-events-none">
                      <img 
                        src="/stationery-template.png" 
                        alt="Company Stationery" 
                        className="w-full h-full object-cover opacity-100"
                      />
                    </div>
                  )}
                  
                  {/* Template content */}
                  <TabsContent value="classic" className="p-12 m-0 border-none h-full">
                    <div className="border-b-2 border-primary pb-6 mb-6">
                      <h1 className="text-3xl font-bold text-primary">
                        {artwork ? artwork.title : collection ? collection.name : "Document Title"}
                      </h1>
                    </div>
                    {artwork && <ArtworkPDFPreview artwork={artwork} templateStyle="basic" />}
                    {collection && <CollectionPDFPreview collection={collection} />}
                    {!artwork && !collection && (
                      <p>Select an artwork or collection to preview</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="modern" className="p-12 m-0 border-none h-full">
                    <div className="flex items-center justify-between mb-8">
                      <h1 className="text-3xl font-light">
                        {artwork ? artwork.title : collection ? collection.name : "Document Title"}
                      </h1>
                      <div className="w-24 h-1 bg-primary"></div>
                    </div>
                    <div className="pl-6 border-l-4 border-primary">
                      {artwork && <ArtworkPDFPreview artwork={artwork} templateStyle="basicWithPrice" />}
                      {collection && <CollectionPDFPreview collection={collection} />}
                      {!artwork && !collection && (
                        <p>Select an artwork or collection to preview</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="minimal" className="p-12 m-0 border-none h-full">
                    <h1 className="text-2xl uppercase tracking-widest mb-8">
                      {artwork ? artwork.title : collection ? collection.name : "Document Title"}
                    </h1>
                    <div className="grid grid-cols-1 gap-6">
                      {artwork && <ArtworkPDFPreview artwork={artwork} templateStyle="complete" />}
                      {collection && <CollectionPDFPreview collection={collection} />}
                      {!artwork && !collection && (
                        <p>Select an artwork or collection to preview</p>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button 
                disabled={!(artwork || collection) || isGenerating}
                onClick={handleGeneratePDF}
                className="flex items-center gap-2"
              >
                {isGenerating ? "Generating PDF..." : "Generate PDF"}
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </Tabs>
        ) : (
          /* Collection PDF Preview - Simplified, no tabs needed */
          <div className="bg-gray-100 p-6 rounded-lg">
            <div className="mx-auto" style={{ width: '595px', height: '842px', position: 'relative' }}>
              <div className="bg-white shadow-lg h-full overflow-auto">
                <div className="absolute inset-0 pointer-events-none">
                  <img 
                    src="/stationery-template.png" 
                    alt="Company Stationery" 
                    className="w-full h-full object-cover opacity-100"
                  />
                </div>
                
                <div className="pt-[11cm] pl-[4cm] pr-[3cm] pb-[3.5cm] h-full overflow-auto relative">
                  <div className="absolute top-[6cm] left-[4cm] font-bold font-sans text-lg">
                    {collection ? collection.name : "Collection Name"}
                  </div>
                  
                  {collection && <CollectionPDFPreview collection={collection} />}
                  {!collection && (
                    <p className="text-sm">No collection selected to preview</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
