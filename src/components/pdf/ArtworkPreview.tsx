
import { Artwork } from "@/hooks/use-artworks";
import { cmToInchFraction } from "@/lib/pdf/styles";

interface ArtworkPreviewProps {
  artwork: Artwork;
  templateStyle: string;
}

export function ArtworkPDFPreview({ artwork, templateStyle }: ArtworkPreviewProps) {
  // Get artist name (placeholder - would need to be fetched from relationship)
  const artistName = "Artist Name";
  
  // Calculate dimensions in inches if height, width, depth are available
  let dimensionsInInches = '';
  if (artwork.height && artwork.width) {
    const heightInInches = cmToInchFraction(artwork.height);
    const widthInInches = cmToInchFraction(artwork.width);
    dimensionsInInches = artwork.depth 
      ? `${heightInInches} x ${widthInInches} x ${cmToInchFraction(artwork.depth)}`
      : `${heightInInches} x ${widthInInches}`;
  }
  
  // Calculate frame dimensions in inches if they exist
  let frameDimensionsInInches = '';
  if (artwork.is_framed && artwork.frame_height && artwork.frame_width) {
    const frameHeightInInches = cmToInchFraction(artwork.frame_height);
    const frameWidthInInches = cmToInchFraction(artwork.frame_width);
    frameDimensionsInInches = artwork.frame_depth 
      ? `${frameHeightInInches} x ${frameWidthInInches} x ${cmToInchFraction(artwork.frame_depth)}`
      : `${frameHeightInInches} x ${frameWidthInInches}`;
  }
  
  // Format edition information
  let editionInfo = '';
  if (artwork.edition_size && artwork.edition_size > 1) {
    editionInfo = `Edition of ${artwork.edition_size}`;
    if (artwork.artist_proofs) {
      editionInfo += ` + ${artwork.artist_proofs} AP`;
    }
  } else {
    editionInfo = 'Unique';
  }
  
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <img 
          src={artwork.image_url || "/placeholder.svg"} 
          alt={artwork.title} 
          className="max-h-24 w-auto mb-4"
        />
        <h2 className="font-bold">{artistName}</h2>
        <h3 className="italic">{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</h3>
        
        {artwork.materials && <p>{artwork.materials}</p>}
        
        {artwork.edition_size && artwork.edition_size > 1 && (
          <p>{editionInfo}</p>
        )}
        
        {artwork.dimensions && (
          <p>{artwork.dimensions}</p>
        )}
        
        {dimensionsInInches && (
          <p>{dimensionsInInches}</p>
        )}
        
        {artwork.is_framed && artwork.frame_height && artwork.frame_width && (
          <p>Frame: {artwork.frame_height} x {artwork.frame_width}{artwork.frame_depth ? ` x ${artwork.frame_depth}` : ''} cm</p>
        )}
        
        {frameDimensionsInInches && (
          <p>Frame: {frameDimensionsInInches}</p>
        )}
        
        {(templateStyle === 'basicWithPrice' || templateStyle === 'complete') && artwork.price && (
          <p className="mt-4 font-semibold">{artwork.currency} {artwork.price.toLocaleString()}</p>
        )}
        
        {templateStyle === 'complete' && (
          <>
            {artwork.location_id && <p className="mt-3">Location: Location Name</p>}
            {artwork.status && <p>Status: {artwork.status}</p>}
            
            {artwork.story && (
              <div className="mt-4">
                <p className="font-semibold">Story:</p>
                <p>{artwork.story}</p>
              </div>
            )}
            
            {artwork.provenance && (
              <div className="mt-4">
                <p className="font-semibold">Provenance:</p>
                <p>{artwork.provenance}</p>
              </div>
            )}
            
            {artwork.exhibition_history && (
              <div className="mt-4">
                <p className="font-semibold">Exhibition History:</p>
                <p>{artwork.exhibition_history}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
