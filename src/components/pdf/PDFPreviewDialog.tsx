
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { PDFTemplateControls } from "./PDFTemplateControls";
import { PDFPreviewContent } from "./PDFPreviewContent";
import { PDFPreviewFooter } from "./PDFPreviewFooter";

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
        <DialogHeader className="flex flex-row items-center justify-between relative pr-10">
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
        
        <PDFPreviewContent
          type={type}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          useStationery={useStationery}
          setUseStationery={setUseStationery}
          title={title}
        />
        
        <PDFPreviewFooter 
          type={type} 
          onOpenChange={onOpenChange} 
          handleApply={handleApply} 
        />
      </DialogContent>
    </Dialog>
  );
}
