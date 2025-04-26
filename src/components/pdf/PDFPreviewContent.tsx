
import { Tabs } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PDFTemplateControls } from "./PDFTemplateControls";
import { ArtworkTemplatePreview } from "./ArtworkTemplatePreview";
import { CollectionTemplatePreview } from "./CollectionTemplatePreview";

interface PDFPreviewContentProps {
  type: "artwork" | "collection";
  selectedTemplate: string;
  setSelectedTemplate: (template: string) => void;
  useStationery: boolean;
  setUseStationery: (useStationery: boolean) => void;
  title: string;
}

export function PDFPreviewContent({
  type,
  selectedTemplate,
  setSelectedTemplate,
  useStationery,
  setUseStationery,
  title
}: PDFPreviewContentProps) {
  return (
    <Tabs 
      defaultValue={type === "artwork" ? "basic" : "collection"} 
      className="flex-1 flex flex-col" 
      onValueChange={setSelectedTemplate}
    >
      <PDFTemplateControls 
        type={type}
        useStationery={useStationery}
        onStationeryChange={setUseStationery}
      />
      
      <ScrollArea className="flex-1">
        <PDFPreviewDocument
          type={type}
          useStationery={useStationery}
          title={title}
        />
      </ScrollArea>
    </Tabs>
  );
}

interface PDFPreviewDocumentProps {
  type: "artwork" | "collection";
  useStationery: boolean;
  title: string;
}

function PDFPreviewDocument({ type, useStationery, title }: PDFPreviewDocumentProps) {
  return (
    <div className="bg-gray-100 p-4 rounded flex items-center justify-center">
      <div className="bg-white shadow-lg" style={{ 
        width: '100%', 
        maxWidth: '595px',
        height: '842px', 
        transform: 'scale(0.8)',
        transformOrigin: 'center center',
        position: 'relative' 
      }}>
        <StationeryBackground show={useStationery} />
        
        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          {type === "artwork" ? (
            <ArtworkTemplatePreview useStationery={useStationery} title={title} />
          ) : (
            <CollectionTemplatePreview title={title} />
          )}
        </div>
      </div>
    </div>
  );
}

interface StationeryBackgroundProps {
  show: boolean;
}

function StationeryBackground({ show }: StationeryBackgroundProps) {
  if (!show) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <img 
        src="/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png"
        alt="Bartha Contemporary Stationery"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
