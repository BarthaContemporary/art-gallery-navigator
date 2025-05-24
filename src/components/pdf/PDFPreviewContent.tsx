import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // Ensure all are imported
import { ScrollArea } from "@/components/ui/scroll-area";
import { PDFTemplateControls } from "./PDFTemplateControls";
import { ArtworkTemplatePreview } from "./ArtworkTemplatePreview"; // This is the simplified preview
import { CollectionTemplatePreview } from "./CollectionTemplatePreview";

interface PDFPreviewContentProps {
  type: "artwork" | "collection";
  selectedTemplate: string; // Still used for collections
  setSelectedTemplate: (template: string) => void; // Still used for collections
  useStationery: boolean;
  setUseStationery: (useStationery: boolean) => void;
  title: string;
  // content prop (which holds ArtworkPDFPreview or CollectionPDFPreview) is no longer needed here,
  // as this component renders its own previews (ArtworkTemplatePreview, CollectionTemplatePreview)
}

export function PDFPreviewContent({
  type,
  selectedTemplate, // For artwork, this will be a fixed value like "unified_artwork_style"
  setSelectedTemplate, // For artwork, this function won't have a UI to be called from for template changes
  useStationery,
  setUseStationery,
  title
}: PDFPreviewContentProps) {
  
  // For artwork, template selection is removed. Stationery is fixed to true.
  const showTemplateControls = type === "collection"; 
  // For artwork, useStationery is true and non-toggleable by user in this component.
  // The parent PDFPreviewDialog sets useStationery to true for artworks.

  return (
    <div className="flex h-full"> {/* Changed from Tabs to a div for more control */}
      {/* Controls Panel (conditionally rendered or simplified for artworks) */}
      <div className="w-1/3 border-r p-4 overflow-y-auto">
        <PDFTemplateControls 
          type={type}
          useStationery={useStationery}
          // For artwork, onStationeryChange will be disabled or hidden as it's always true.
          onStationeryChange={setUseStationery} 
          // Pass selectedTemplate and setSelectedTemplate for collections
          selectedTemplate={selectedTemplate}
          onTemplateChange={setSelectedTemplate}
        />
      </div>
      
      {/* Preview Panel */}
      <ScrollArea className="flex-1 bg-gray-100">
        <div className="p-4 flex items-center justify-center min-h-full"> {/* Ensure centering */}
          <PDFPreviewDocument
            type={type}
            useStationery={type === "artwork" ? true : useStationery} // Artworks always use stationery
            template={selectedTemplate} // For artwork, this is a fixed internal value
            title={title}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

interface PDFPreviewDocumentProps {
  type: "artwork" | "collection";
  useStationery: boolean;
  template: string; // For artwork, this is ignored by ArtworkTemplatePreview
  title: string;
}

function PDFPreviewDocument({ type, useStationery, template, title }: PDFPreviewDocumentProps) {
  return (
    // This div simulates the A4 paper and scales it down
    <div className="bg-white shadow-lg relative overflow-hidden" style={{ 
      width: '210mm', // A4 width
      height: '297mm', // A4 height
      transform: 'scale(0.7)', // Adjust scale as needed for preview size
      transformOrigin: 'top center', // Scale from top center
      margin: '20px auto' // Add some margin for better visual separation
    }}>
      {useStationery && <StationeryBackground />}
      
      {/* This div is the actual content area within the "paper" */}
      <div 
        style={{ 
          position: 'relative', 
          zIndex: 5, 
          height: '100%', 
          // Padding here should match the stationery's content-wrapper padding for accuracy
          // Or, ArtworkTemplatePreview should internally handle its own padding based on stationery.
          // For now, let's assume stationeryStyle in generateArtworkHTML handles the main padding.
          // The py-10 px-8 in ArtworkTemplatePreview was for its internal content.
        }}
      >
        {type === "artwork" ? (
          // ArtworkTemplatePreview no longer needs template or useStationery props directly.
          // It's styled to always assume stationery.
          <ArtworkTemplatePreview title={title} />
        ) : (
          <CollectionTemplatePreview title={title} /> // Assuming this still uses template if needed
        )}
      </div>
    </div>
  );
}

function StationeryBackground() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 1 }}
    >
      <img 
        src="/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png"
        alt="Bartha Contemporary Stationery"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
