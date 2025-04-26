
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
      value={selectedTemplate}
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
          template={selectedTemplate}
          title={title}
        />
      </ScrollArea>
    </Tabs>
  );
}

interface PDFPreviewDocumentProps {
  type: "artwork" | "collection";
  useStationery: boolean;
  template: string;
  title: string;
}

function PDFPreviewDocument({ type, useStationery, template, title }: PDFPreviewDocumentProps) {
  return (
    <div className="bg-gray-100 p-4 rounded flex items-center justify-center">
      <div className="bg-white shadow-lg relative overflow-hidden" style={{ 
        width: '100%', 
        maxWidth: '595px',
        height: '842px', 
        transform: 'scale(0.8)',
        transformOrigin: 'center center',
      }}>
        {useStationery && <StationeryBackground />}
        
        <div style={{ position: 'relative', zIndex: 5, height: '100%', padding: '3rem' }}>
          {type === "artwork" ? (
            <ArtworkTemplatePreview useStationery={useStationery} template={template} title={title} />
          ) : (
            <CollectionTemplatePreview title={title} />
          )}
        </div>
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
