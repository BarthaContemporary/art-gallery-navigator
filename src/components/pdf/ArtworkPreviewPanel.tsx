
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkPDFPreview } from "@/lib/pdf-templates";

interface ArtworkPreviewPanelProps {
  artwork: Artwork | undefined;
  selectedTemplate: string;
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

      <Tabs defaultValue="classic" value={selectedTemplate} onValueChange={onTemplateChange}>
        <TabsList className="grid grid-cols-3 mb-6 w-full max-w-md mx-auto">
          <TabsTrigger value="classic">Classic</TabsTrigger>
          <TabsTrigger value="modern">Modern</TabsTrigger>
          <TabsTrigger value="minimal">Minimal</TabsTrigger>
        </TabsList>
        
        <div className="bg-gray-100 p-6 rounded-lg">
          <div className="mx-auto" style={{ width: '595px', height: '842px', position: 'relative' }}>
            <div className="bg-white shadow-lg h-full overflow-auto">
              {useStationery && (
                <div className="absolute inset-0 pointer-events-none z-0">
                  <img 
                    src="/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png" 
                    alt="Company Stationery" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <TabsContent value="classic" className="p-12 m-0 border-none h-full z-10 relative">
                <div className="border-b-2 border-primary pb-6 mb-6">
                  <h1 className="text-3xl font-bold text-primary">
                    {artwork ? artwork.title : "Document Title"}
                  </h1>
                </div>
                {artwork ? (
                  <ArtworkPDFPreview artwork={artwork} templateStyle="basic" />
                ) : (
                  <p>Select an artwork to preview</p>
                )}
              </TabsContent>
              
              <TabsContent value="modern" className="p-12 m-0 border-none h-full z-10 relative">
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-3xl font-light">
                    {artwork ? artwork.title : "Document Title"}
                  </h1>
                  <div className="w-24 h-1 bg-primary"></div>
                </div>
                <div className="pl-6 border-l-4 border-primary">
                  {artwork ? (
                    <ArtworkPDFPreview artwork={artwork} templateStyle="basicWithPrice" />
                  ) : (
                    <p>Select an artwork to preview</p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="minimal" className="p-12 m-0 border-none h-full z-10 relative">
                <h1 className="text-2xl uppercase tracking-widest mb-8">
                  {artwork ? artwork.title : "Document Title"}
                </h1>
                <div className="grid grid-cols-1 gap-6">
                  {artwork ? (
                    <ArtworkPDFPreview artwork={artwork} templateStyle="complete" />
                  ) : (
                    <p>Select an artwork to preview</p>
                  )}
                </div>
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
