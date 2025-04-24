
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save } from "lucide-react";

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
        <DialogHeader>
          <DialogTitle>PDF Template Preview</DialogTitle>
          <DialogDescription>
            Select a template style for your {type === "artwork" ? "artwork" : "collection"} PDF
          </DialogDescription>
        </DialogHeader>
        
        {type === "artwork" && (
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="stationery-mode"
              checked={useStationery}
              onCheckedChange={setUseStationery}
            />
            <Label htmlFor="stationery-mode">Use Company Stationery</Label>
          </div>
        )}
        
        <Tabs 
          defaultValue={type === "artwork" ? "basic" : "collection"} 
          className="flex-1 flex flex-col" 
          onValueChange={setSelectedTemplate}
        >
          {type === "artwork" ? (
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="basicWithPrice">Basic with Price</TabsTrigger>
              <TabsTrigger value="complete">Complete</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-1 mb-4">
              <TabsTrigger value="collection">Collection Overview</TabsTrigger>
            </TabsList>
          )}
          
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
                    <>
                      <TabsContent value="basic" className="m-0 p-0 h-full">
                        <div className={`${useStationery ? 'pt-[11cm] pl-[4cm] pr-[3cm] pb-[3.5cm]' : 'p-[3cm] pb-[3.5cm]'} h-full overflow-auto`}>
                          {useStationery && (
                            <div className="absolute top-[6cm] right-[4cm] font-bold uppercase">
                              ARTIST NAME
                            </div>
                          )}
                          <div>
                            <div className="mb-6">
                              <img 
                                src="/placeholder.svg" 
                                alt="Artwork" 
                                className="max-h-[6cm] w-auto mb-6"
                              />
                              <h2 className="text-lg font-bold mb-2">Artist Name</h2>
                              <h3 className="text-lg font-normal italic mb-2">
                                {title}, 2023
                              </h3>
                              <p className="mb-2">Materials description</p>
                              <p className="mb-2">Edition of 10</p>
                              <p className="mb-1">100 x 80 x 5 cm</p>
                              <p className="mb-1">39 3/8 x 31 1/2 x 2"</p>
                              <p className="mb-1">Frame: 105 x 85 x 7 cm</p>
                              <p className="mb-1">Frame: 41 3/8 x 33 1/2 x 2 3/4"</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="basicWithPrice" className="m-0 p-0 h-full">
                        <div className={`${useStationery ? 'pt-[11cm] pl-[4cm] pr-[3cm] pb-[3.5cm]' : 'p-[3cm] pb-[3.5cm]'} h-full overflow-auto`}>
                          {useStationery && (
                            <div className="absolute top-[6cm] right-[4cm] font-bold uppercase">
                              ARTIST NAME
                            </div>
                          )}
                          <div>
                            <div className="mb-6">
                              <img 
                                src="/placeholder.svg" 
                                alt="Artwork" 
                                className="max-h-[6cm] w-auto mb-6"
                              />
                              <h2 className="text-lg font-bold mb-2">Artist Name</h2>
                              <h3 className="text-lg font-normal italic mb-2">
                                {title}, 2023
                              </h3>
                              <p className="mb-2">Materials description</p>
                              <p className="mb-2">Edition of 10</p>
                              <p className="mb-1">100 x 80 x 5 cm</p>
                              <p className="mb-1">39 3/8 x 31 1/2 x 2"</p>
                              <p className="mb-1">Frame: 105 x 85 x 7 cm</p>
                              <p className="mb-1">Frame: 41 3/8 x 33 1/2 x 2 3/4"</p>
                              <p className="mt-4 font-semibold">£ 10,000</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="complete" className="m-0 p-0 h-full">
                        <div className={`${useStationery ? 'pt-[11cm] pl-[4cm] pr-[3cm] pb-[3.5cm]' : 'p-[3cm] pb-[3.5cm]'} h-full overflow-auto`}>
                          {useStationery && (
                            <div className="absolute top-[6cm] right-[4cm] font-bold uppercase">
                              ARTIST NAME
                            </div>
                          )}
                          <div>
                            <div className="mb-6">
                              <img 
                                src="/placeholder.svg" 
                                alt="Artwork" 
                                className="max-h-[6cm] w-auto mb-6"
                              />
                              <h2 className="text-lg font-bold mb-2">Artist Name</h2>
                              <h3 className="text-lg font-normal italic mb-2">
                                {title}, 2023
                              </h3>
                              <p className="mb-2">Materials description</p>
                              <p className="mb-2">Edition of 10</p>
                              <p className="mb-1">100 x 80 x 5 cm</p>
                              <p className="mb-1">39 3/8 x 31 1/2 x 2"</p>
                              <p className="mb-1">Frame: 105 x 85 x 7 cm</p>
                              <p className="mb-1">Frame: 41 3/8 x 33 1/2 x 2 3/4"</p>
                              <p className="mt-4 font-semibold">£ 10,000</p>
                              <p className="mt-2">Location: London Gallery</p>
                              <p className="mt-2">Status: Available</p>
                              
                              <div className="mt-6">
                                <p className="font-bold">Story:</p>
                                <p className="mt-1">Artwork story goes here...</p>
                              </div>
                              
                              <div className="mt-4">
                                <p className="font-bold">Provenance:</p>
                                <p className="mt-1">Artwork provenance goes here...</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </>
                  ) : (
                    <TabsContent value="collection" className="m-0 p-0 h-full">
                      <div className="pt-[11cm] pl-[4cm] pr-[3cm] pb-[3.5cm] h-full overflow-auto">
                        <div className="absolute top-[6cm] left-[4cm] font-bold text-lg">
                          {title}
                        </div>
                        <div>
                          <p className="mb-6">Collection description text...</p>
                          
                          <h3 className="font-bold mb-4">Artworks in this Collection:</h3>
                          
                          <div className="space-y-6">
                            <div className="flex border-b pb-4">
                              <img 
                                src="/placeholder.svg" 
                                alt="Artwork" 
                                className="w-[3cm] h-[3cm] object-cover mr-4"
                              />
                              <div>
                                <p className="font-bold">Artist Name</p>
                                <p className="italic">Artwork Title, 2023</p>
                                <p>Materials</p>
                                <p>Edition of 10</p>
                                <p>100 x 80 x 5 cm</p>
                                <p>Frame: 105 x 85 x 7 cm</p>
                                <p>Location: London Gallery</p>
                                <p className="mt-2 font-semibold">£ 10,000</p>
                              </div>
                            </div>
                            
                            <div className="flex border-b pb-4">
                              <img 
                                src="/placeholder.svg" 
                                alt="Artwork" 
                                className="w-[3cm] h-[3cm] object-cover mr-4"
                              />
                              <div>
                                <p className="font-bold">Artist Name</p>
                                <p className="italic">Artwork Title, 2023</p>
                                <p>Materials</p>
                                <p>Edition of 10</p>
                                <p>100 x 80 x 5 cm</p>
                                <p>Frame: 105 x 85 x 7 cm</p>
                                <p>Location: London Gallery</p>
                                <p className="mt-2 font-semibold">£ 10,000</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </Tabs>
        
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save and Generate PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
