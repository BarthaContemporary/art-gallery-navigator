
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save } from "lucide-react";
import { PDFTemplateControls } from "./PDFTemplateControls";
import { ArtworkTemplatePreview } from "./ArtworkTemplatePreview";
import { CollectionTemplatePreview } from "./CollectionTemplatePreview";

export interface PDFPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (template: string, useStationery: boolean) => void;
  title: string;
  content: React.ReactNode;
  type: "artwork" | "collection";
}

export function PDFPreviewDialog({
  open,
  onOpenChange,
  onApply,
  title,
  content,
  type
}: PDFPreviewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(type === "artwork" ? "basic" : "collection");
  const [useStationery, setUseStationery] = useState<boolean>(type === "collection" ? true : false);
  
  const handleApply = () => {
    onApply(selectedTemplate, useStationery);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>PDF Template Preview</DialogTitle>
            <DialogDescription>
              {type === "artwork" ? "Select a template style for your artwork PDF" : "Collection PDF preview"}
            </DialogDescription>
          </div>
          
          {type === "collection" && (
            <Button onClick={handleApply} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save and Generate PDF
            </Button>
          )}
        </DialogHeader>
        
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
            <div className="bg-gray-100 p-4 rounded flex items-center justify-center">
              <div className="bg-white shadow-lg" style={{ width: '595px', height: '842px', position: 'relative' }}>
                {useStationery && (
                  <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                    <img 
                      src="/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png"
                      alt="Bartha Contemporary Stationery"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                
                <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
                  {type === "artwork" ? (
                    <ArtworkTemplatePreview useStationery={useStationery} title={title} />
                  ) : (
                    <CollectionTemplatePreview title={title} />
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </Tabs>
        
        {type === "artwork" && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save and Generate PDF
            </Button>
          </div>
        )}
        
        {type === "collection" && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
