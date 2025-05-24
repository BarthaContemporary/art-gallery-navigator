import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkPDFPreview } from "@/components/pdf/ArtworkPreview";

interface ArtworkPreviewPanelProps {
  artwork: Artwork | undefined;
  selectedTemplate: string; 
  useStationery: boolean; // Kept to show/hide stationery overlay in preview
  isGenerating: boolean;
  onTemplateChange: (value: string) => void;
  onGeneratePDF: () => void;
}

export function ArtworkPreviewPanel({
  artwork,
  selectedTemplate,
  useStationery, // This prop is still used for the visual preview
  isGenerating,
  onTemplateChange,
  onGeneratePDF
}: ArtworkPreviewPanelProps) {
  // The stationery switch is removed from this panel.
  // Artworks always use stationery for PDF generation.
  // The useStationery prop now primarily controls the visual overlay in this preview.
  return (
    <>
      {/* 
        The Switch for "Use Company Stationery" has been removed from this component.
        The `useStationery` prop (controlled by the parent page PDFTemplates.tsx) 
        will still determine if the stationery background is shown in this live preview.
        For actual PDF generation, artworks always use stationery.
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
              {useStationery && ( // Stationery overlay in preview still conditional based on prop
                <div className="absolute inset-0 pointer-events-none z-0">
                  <img 
                    src="/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png" 
                    alt="Company Stationery" 
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              )}
              
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
