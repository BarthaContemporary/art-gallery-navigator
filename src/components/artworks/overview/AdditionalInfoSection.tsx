
import { Artwork } from "@/hooks/use-artworks";

interface AdditionalInfoSectionProps {
  artwork: Artwork;
}

export function AdditionalInfoSection({ artwork }: AdditionalInfoSectionProps) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Additional Information</h3>
      <dl className="space-y-2">
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Condition</dt>
          <dd>{artwork.condition || 'N/A'}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Signature</dt>
          <dd>{artwork.signature_type || 'N/A'}</dd>
        </div>
        {artwork.signature_details && (
          <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">Signature Details</dt>
            <dd>{artwork.signature_details}</dd>
          </div>
        )}
        {artwork.provenance && (
          <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">Provenance</dt>
            <dd>{artwork.provenance}</dd>
          </div>
        )}
        {artwork.story && (
          <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">Story</dt>
            <dd>{artwork.story}</dd>
          </div>
        )}
        {artwork.exhibition_history && (
          <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">Exhibition History</dt>
            <dd>{artwork.exhibition_history}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
