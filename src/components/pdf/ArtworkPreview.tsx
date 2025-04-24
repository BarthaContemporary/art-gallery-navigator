
import { Artwork } from "@/hooks/use-artworks";

interface ArtworkPreviewProps {
  artwork: Artwork;
}

export function ArtworkPDFPreview({ artwork }: ArtworkPreviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Basic Information</h2>
        <div className="bg-muted/50 p-3 rounded-md mt-2">
          <p><span className="font-medium">Medium:</span> {artwork.medium_type || 'N/A'}</p>
          {artwork.materials && <p><span className="font-medium">Materials:</span> {artwork.materials}</p>}
          {artwork.dimensions && <p><span className="font-medium">Dimensions:</span> {artwork.dimensions}</p>}
          {artwork.status && <p><span className="font-medium">Status:</span> {artwork.status}</p>}
        </div>
      </div>
      
      {(artwork.story || artwork.provenance) && (
        <div>
          <h2 className="text-lg font-medium">Details</h2>
          <div className="bg-muted/50 p-3 rounded-md mt-2">
            {artwork.story && (
              <div className="mb-3">
                <p className="font-medium">Story:</p>
                <p>{artwork.story}</p>
              </div>
            )}
            {artwork.provenance && (
              <div>
                <p className="font-medium">Provenance:</p>
                <p>{artwork.provenance}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

