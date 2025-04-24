
import { Collection } from "@/hooks/use-collections";

interface CollectionPreviewProps {
  collection: Collection;
}

export function CollectionPDFPreview({ collection }: CollectionPreviewProps) {
  return (
    <div className="space-y-1 text-[10px]">
      {collection.description && (
        <div className="mt-1 mb-3">
          <p className="text-[10px]">{collection.description}</p>
        </div>
      )}
      
      <h2 className="text-xs font-medium mb-2">Artworks in this Collection</h2>
      
      {collection.artworks && collection.artworks.length > 0 ? (
        <div className="space-y-2">
          {collection.artworks.map((artwork) => (
            <div key={artwork.id} className="flex border-b pb-2">
              <img
                src={artwork.image_url || "/placeholder.svg"}
                alt={artwork.title}
                className="w-8 h-8 object-cover mr-2"
              />
              <div className="text-[10px]">
                <p className="font-bold">Artist Name</p>
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
                
                {artwork.location_id && <p>Location: Location Name</p>}
                {artwork.price && <p className="font-semibold mt-1">{artwork.currency} {artwork.price.toLocaleString()}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px]">No artworks in this collection</p>
      )}
    </div>
  );
}
