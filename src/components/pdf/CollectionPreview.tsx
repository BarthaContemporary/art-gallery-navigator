
import { Collection } from "@/hooks/use-collections";

interface CollectionPreviewProps {
  collection: Collection;
}

export function CollectionPDFPreview({ collection }: CollectionPreviewProps) {
  return (
    <div className="space-y-6">
      {collection.description && (
        <div className="bg-muted/50 p-3 rounded-md">
          <p>{collection.description}</p>
        </div>
      )}
      
      <h2 className="text-lg font-medium">Artworks</h2>
      
      {collection.artworks && collection.artworks.length > 0 ? (
        <div className="space-y-4">
          {collection.artworks.map((artwork) => (
            <div key={artwork.id} className="border p-3 rounded-md">
              <h3 className="font-medium">{artwork.title} {artwork.year && `(${artwork.year})`}</h3>
              <p><span className="text-sm text-muted-foreground">Medium:</span> {artwork.medium_type || 'N/A'}</p>
              {artwork.materials && <p className="text-sm">{artwork.materials}</p>}
              {artwork.dimensions && <p className="text-sm">{artwork.dimensions}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p>No artworks in this collection</p>
      )}
    </div>
  );
}

