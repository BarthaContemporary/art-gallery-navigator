import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";

interface ArtworkTemplatePreviewProps {
  useStationery: boolean;
  title: string;
}

export function ArtworkTemplatePreview({ useStationery, title }: ArtworkTemplatePreviewProps) {
  const previewStyles = `
    ${useStationery ? 'pt-[11cm] pl-[4cm] pr-[3cm] pb-[3.5cm]' : 'p-[3cm] pb-[3.5cm]'}
    h-full overflow-auto text-[12px]
  `;

  const headerArtistStyle = useStationery ? 'absolute top-[6cm] left-[4cm] font-bold uppercase' : '';

  return (
    <>
      <TabsContent value="basic" className="m-0 p-0 h-full">
        <div className={previewStyles}>
          {useStationery && (
            <div className={headerArtistStyle}>
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
        <div className={previewStyles}>
          {useStationery && (
            <div className={headerArtistStyle}>
              ARTIST NAME
            </div>
          )}
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
      </TabsContent>
      
      <TabsContent value="complete" className="m-0 p-0 h-full">
        <div className={previewStyles}>
          {useStationery && (
            <div className={headerArtistStyle}>
              ARTIST NAME
            </div>
          )}
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
      </TabsContent>
    </>
  );
}
