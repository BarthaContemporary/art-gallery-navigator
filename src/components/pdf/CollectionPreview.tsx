
import { Collection } from "@/hooks/use-collections";
import { useArtist } from "@/hooks/use-artist";
import { useLocation } from "@/hooks/use-location";
import { useCollectionDocuments } from "@/hooks/use-collection-documents";
import { ArrowUpRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollectionPreviewProps {
  collection: Collection;
}

export function CollectionPDFPreview({ collection }: CollectionPreviewProps) {
  const { data: documents } = useCollectionDocuments(collection.id);
  
  const handleClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank');
  };
  
  return (
    <div className="space-y-1 text-[10px]">
      {collection.description && (
        <div className="mt-0 mb-1">
          <p className="text-[10px] leading-tight">{collection.description}</p>
        </div>
      )}
      
      <h2 className="text-[9px] font-semibold mt-2 mb-1">Artworks in this Collection</h2>
      
      {collection.artworks && collection.artworks.length > 0 ? (
        <div className="space-y-1">
          {collection.artworks.map((artwork) => {
            const { data: artist } = useArtist(artwork.artist_id);
            const { data: location } = useLocation(artwork.location_id);
            
            return (
              <div key={artwork.id} className="flex border-b pb-1 hover:bg-gray-50 relative">
                <div className="w-6 h-6 mr-1 flex-shrink-0 flex items-center justify-center">
                  <img
                    src={artwork.image_url || "/placeholder.svg"}
                    alt={artwork.title}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="text-[10px] leading-tight flex-grow pr-8">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{artist?.full_name || "Artist Name"}</p>
                  </div>
                  <p className="italic">{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</p>
                  {artwork.medium_type && <p>{artwork.medium_type}</p>}
                  {artwork.materials && <p>{artwork.materials}</p>}
                  
                  {artwork.edition_size && artwork.edition_size > 1 && (
                    <p>Edition of {artwork.edition_size}
                      {artwork.artist_proofs ? ` + ${artwork.artist_proofs} AP` : ''}
                    </p>
                  )}
                  
                  {artwork.dimensions && <p>{artwork.dimensions}</p>}
                  
                  {artwork.is_framed && artwork.frame_height && artwork.frame_width && (
                    <p>Frame: {artwork.frame_height} x {artwork.frame_width}{artwork.frame_depth ? ` x ${artwork.frame_depth}` : ''} cm</p>
                  )}
                  
                  {artwork.location_id && <p>Location: {location?.name || "Location Name"}</p>}
                  {artwork.price && <p className="font-semibold mt-0.5">{artwork.currency} {artwork.price.toLocaleString()}</p>}
                </div>
                <div className="absolute right-0 top-1">
                  <Button 
                    onClick={(e) => handleClick(`/artworks/${artwork.id}`, e)}
                    className="h-5 w-5 min-h-0 p-1 bg-primary hover:bg-primary/80 text-white"
                    variant="default"
                    size="icon"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px]">No artworks in this collection</p>
      )}

      <h2 className="text-[9px] font-semibold mt-3 mb-1">Attached Files</h2>
      {documents && documents.length > 0 ? (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center hover:bg-gray-50 border-b pb-1 relative pr-8">
              <div className="flex items-center gap-1 flex-grow">
                <FileText className="h-3 w-3 text-gray-500" />
                <span>{doc.file_name}</span>
              </div>
              <div className="absolute right-0 top-0">
                <Button 
                  onClick={(e) => handleClick(doc.file_url, e)}
                  className="h-5 w-5 min-h-0 p-1 bg-primary hover:bg-primary/80 text-white"
                  variant="default"
                  size="icon"
                >
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px]">No files attached to this collection</p>
      )}
    </div>
  );
}
