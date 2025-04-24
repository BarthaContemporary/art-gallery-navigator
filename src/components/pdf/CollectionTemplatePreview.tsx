
import { TabsContent } from "@/components/ui/tabs";

interface CollectionTemplatePreviewProps {
  title: string;
}

export function CollectionTemplatePreview({ title }: CollectionTemplatePreviewProps) {
  return (
    <TabsContent value="collection" className="m-0 p-0 h-full">
      <div className="pt-[8cm] pl-[4cm] pr-[3cm] pb-[3.5cm] h-full overflow-auto">
        <div className="absolute top-[6cm] left-[4cm] font-bold text-[10px]">
          {title}
        </div>
        <div className="text-[10px]">
          <p className="mb-1">Collection description text...</p>
          
          <h3 className="font-bold text-[9px] my-1">Artworks in this Collection:</h3>
          
          <div className="space-y-2">
            <div className="flex border-b pb-1">
              <img 
                src="/placeholder.svg" 
                alt="Artwork" 
                className="w-6 h-6 object-cover mr-1"
              />
              <div className="text-[10px] leading-tight">
                <p className="font-bold">Artist Name</p>
                <p className="italic">Artwork Title, 2023</p>
                <p>Materials</p>
                <p>Edition of 10</p>
                <p>100 x 80 x 5 cm</p>
                <p>Frame: 105 x 85 x 7 cm</p>
                <p>Location: London Gallery</p>
                <p className="mt-0.5 font-semibold">£ 10,000</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
