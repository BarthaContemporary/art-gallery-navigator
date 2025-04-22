
import { Artwork } from "@/hooks/use-artworks";

interface DimensionsSectionProps {
  artwork: Artwork;
}

export function DimensionsSection({ artwork }: DimensionsSectionProps) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Dimensions & Physical Details</h3>
      <dl className="space-y-2">
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Dimensions</dt>
          <dd>{artwork.dimensions}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Height × Width × Depth</dt>
          <dd>
            {artwork.height || 'N/A'} × {artwork.width || 'N/A'} × {artwork.depth || 'N/A'} cm
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Price</dt>
          <dd>
            {artwork.price ? `${artwork.currency} ${artwork.price.toLocaleString()}` : 'N/A'}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Framed</dt>
          <dd>{artwork.is_framed ? 'Yes' : 'No'}</dd>
        </div>
        {artwork.is_framed && (
          <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">Frame Dimensions (H×W×D)</dt>
            <dd>
              {artwork.frame_height || 'N/A'} × {artwork.frame_width || 'N/A'} × {artwork.frame_depth || 'N/A'} cm
            </dd>
          </div>
        )}
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Weight</dt>
          <dd>{artwork.weight ? `${artwork.weight} kg` : 'N/A'}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-medium text-muted-foreground">Has Crate</dt>
          <dd>{artwork.has_crate ? 'Yes' : 'No'}</dd>
        </div>
        {artwork.has_crate && (
          <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">Crate Dimensions (H×W×D)</dt>
            <dd>
              {artwork.crate_height || 'N/A'} × {artwork.crate_width || 'N/A'} × {artwork.crate_depth || 'N/A'} cm
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
