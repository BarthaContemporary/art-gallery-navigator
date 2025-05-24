import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkPDFPreview } from "@/components/pdf/ArtworkPreview";

interface ArtworkPreviewPanelProps {
  artwork: Artwork | undefined;
  selectedTemplate: string; // This prop is still here, but ArtworkPDFPreview doesn't use it.
                           // The Tabs component itself still uses it to switch views.
                           // However, the content of each tab will now be the same simplified preview.
                           // We should consider if these tabs are still needed. For now, I'll keep them
                           // but ensure ArtworkPDFPreview is called correctly.
  useStationery: boolean;
  isGenerating: boolean;
  onTemplateChange: (value: string) => void;
  onStationeryChange: (value: boolean) => void;
  onGeneratePDF: () => void;
}

export function ArtworkPreviewPanel({
  artwork,
  selectedTemplate,
  useStationery,
  isGenerating,
  onTemplateChange,
  onStationeryChange,
  onGeneratePDF
}: ArtworkPreviewPanelProps) {
  // Since we've unified the artwork PDF style, the "template" selection (Classic, Modern, Minimal)
  // via Tabs might be misleading as they will all render the same preview style.
  // For now, I'm keeping the Tabs structure as it wasn't explicitly asked to be removed from this page,
  // but the content within each tab will be the same unified preview.
  // The `templateStyle` prop is removed from ArtworkPDFPreview.
  return (
    <>
      <div className="flex items-center space-x-2 mb-6">
        <Switch
          id="stationery-mode"
          checked={useStationery}
          onCheckedChange={onStationeryChange}
        />
        <Label htmlFor="stationery-mode">Use Company Stationery</Label>
      </div>

      {/* The Tabs for "Classic", "Modern", "Minimal" are less relevant now since the actual PDF is unified.
          However, to minimize changes to this specific component's props and structure immediately,
          I will keep the tabs but they will all show the same preview content.
          The `selectedTemplate` state will still switch the active tab, but ArtworkPDFPreview won't use it.
      */}
      <Tabs defaultValue="classic" value={selectedTemplate} onValueChange={onTemplateChange}>
        <TabsList className="grid grid-cols-3 mb-6 w-full max-w-md mx-auto">
          <TabsTrigger value="classic">Classic</TabsTrigger>
          <TabsTrigger value="modern">Modern</TabsTrigger>
          <TabsTrigger value="minimal">Minimal</TabsTrigger>
        </TabsList>
        
        <div className="bg-gray-100 p-6 rounded-lg">
          <div className="mx-auto" style={{ width: '595px', height: '842px', position: 'relative' }}>
            <div className="bg-white shadow-lg h-full overflow-auto relative">
              {useStationery && (
                <div className="absolute inset-0 pointer-events-none z-0">
                  <img 
                    src="/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png" 
                    alt="Company Stationery" 
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              )}
              
              {/* All TabsContent will now render the same ArtworkPDFPreview without templateStyle */}
              <TabsContent value="classic" className="p-12 m-0 border-none h-full z-10 relative">
                {artwork ? (
                  <ArtworkPDFPreview artwork={artwork} />
                ) : (
                  <p>Select an artwork to preview</p>
                )}
              </TabsContent>
              
              <TabsContent value="modern" className="p-12 m-0 border-none h-full z-10 relative">
                 {artwork ? (
                  <ArtworkPDFPreview artwork={artwork} />
                ) : (
                  <p>Select an artwork to preview</p>
                )}
              </TabsContent>
              
              <TabsContent value="minimal" className="p-12 m-0 border-none h-full z-10 relative">
                {artwork ? (
                  <ArtworkPDFPreview artwork={artwork} />
                ) : (
                  <p>Select an artwork to preview</p>
                )}
              </TabsContent>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <Button 
            disabled={!artwork || isGenerating}
            onClick={onGeneratePDF}
            className="flex items-center gap-2"
          >
            {isGenerating ? "Generating PDF..." : "Generate PDF"}
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </Tabs>
    </>
  );
}
