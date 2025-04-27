
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    type === "artwork" ? "classic" : "collection"
  );
  const [useStationery, setUseStationery] = useState<boolean>(
    type === "collection" ? true : false
  );
  
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
          
          <Button onClick={handleApply} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Generate PDF
          </Button>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4">
          {type === "artwork" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <Tabs 
                  defaultValue="classic" 
                  value={selectedTemplate} 
                  onValueChange={setSelectedTemplate}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
                    <TabsTrigger value="classic">Classic</TabsTrigger>
                    <TabsTrigger value="modern">Modern</TabsTrigger>
                    <TabsTrigger value="minimal">Minimal</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex items-center space-x-2 mb-6">
                <Switch
                  id="preview-stationery-mode"
                  checked={useStationery}
                  onCheckedChange={setUseStationery}
                />
                <Label htmlFor="preview-stationery-mode">Use Company Stationery</Label>
              </div>
            </>
          )}
          
          <div className="bg-gray-100 p-4 rounded flex items-center justify-center">
            <div className="bg-white shadow-lg relative overflow-hidden" style={{ 
              width: '100%', 
              maxWidth: '595px',
              minHeight: '842px', 
              transform: 'scale(0.9)',
              transformOrigin: 'top center',
            }}>
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
              
              <div className="relative z-10 p-12 min-h-full">
                {type === "artwork" && (
                  <>
                    {selectedTemplate === "classic" && (
                      <div className="border-b-2 border-primary pb-6 mb-6">
                        <h1 className="text-3xl font-bold text-primary">{title}</h1>
                      </div>
                    )}
                    
                    {selectedTemplate === "modern" && (
                      <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-light">{title}</h1>
                        <div className="w-24 h-1 bg-primary"></div>
                      </div>
                    )}
                    
                    {selectedTemplate === "minimal" && (
                      <h1 className="text-2xl uppercase tracking-widest mb-8">{title}</h1>
                    )}
                  </>
                )}
                
                {content}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-4 px-4 py-2 border-t">
          <Button variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Generate PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
