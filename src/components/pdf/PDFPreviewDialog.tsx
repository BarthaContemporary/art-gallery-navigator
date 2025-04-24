import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PDFPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (template: string, useStationery: boolean) => void;
  title: string;
  content: React.ReactNode;
}

export function PDFPreviewDialog({
  open,
  onOpenChange,
  onApply,
  title,
  content
}: PDFPreviewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("classic");
  const [useStationery, setUseStationery] = useState<boolean>(false);
  
  const handleApply = () => {
    onApply(selectedTemplate, useStationery);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>PDF Template Preview</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="stationery-mode"
            checked={useStationery}
            onCheckedChange={setUseStationery}
          />
          <Label htmlFor="stationery-mode">Use Company Stationery</Label>
        </div>
        
        <Tabs defaultValue="classic" className="flex-1 flex flex-col" onValueChange={setSelectedTemplate}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="classic">Classic</TabsTrigger>
            <TabsTrigger value="modern">Modern</TabsTrigger>
            <TabsTrigger value="minimal">Minimal</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1">
            <div className="bg-gray-100 p-4 rounded flex items-center justify-center">
              <div className="bg-white shadow-lg" style={{ width: '595px', height: '842px', position: 'relative' }}>
                {useStationery && (
                  <div className="absolute inset-0 pointer-events-none">
                    <img 
                      src="/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png"
                      alt="Bartha Contemporary Stationery"
                      className="w-full h-full object-contain opacity-90"
                    />
                  </div>
                )}
                
                <TabsContent value="classic" className="m-0 p-0 h-full">
                  <div className="p-12 h-full overflow-auto">
                    <div className="border-b-2 border-primary pb-6 mb-6">
                      <h1 className="text-3xl font-bold text-primary">{title}</h1>
                    </div>
                    {content}
                  </div>
                </TabsContent>
                
                <TabsContent value="modern" className="m-0 p-0 h-full">
                  <div className="p-12 h-full overflow-auto">
                    <div className="flex items-center justify-between mb-8">
                      <h1 className="text-3xl font-light">{title}</h1>
                      <div className="w-24 h-1 bg-primary"></div>
                    </div>
                    <div className="pl-6 border-l-4 border-primary">
                      {content}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="minimal" className="m-0 p-0 h-full">
                  <div className="p-12 h-full overflow-auto">
                    <h1 className="text-2xl uppercase tracking-widest mb-8">{title}</h1>
                    <div className="grid grid-cols-1 gap-6">
                      {content}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </div>
          </ScrollArea>
        </Tabs>
        
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply and Generate PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
