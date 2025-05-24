
import { Artwork } from "@/hooks/use-artworks";
import { cmToInchFraction } from "@/lib/pdf/unit-conversion";

interface ArtworkPreviewProps {
  artwork: Artwork;
}

export function ArtworkPDFPreview({ artwork }: ArtworkPreviewProps) {
  const artistName = artwork.artist_name || "Artist Name"; // Use artwork.artist_name
  
  let dimensionsInInches = '';
  if (artwork.height && artwork.width) {
    const heightInInches = cmToInchFraction(artwork.height);
    const widthInInches = cmToInchFraction(artwork.width);
    dimensionsInInches = artwork.depth 
      ? `${heightInInches} x ${widthInInches} x ${cmToInchFraction(artwork.depth)}"` 
      : `${heightInInches} x ${widthInInches}"`;
  }
  
  let editionInfo = '';
  if (artwork.classification === 'Unique') {
    editionInfo = 'Unique';
  } else if (artwork.edition_size) {
    editionInfo = `Edition of ${artwork.edition_size}`;
    if (artwork.artist_proofs) {
      editionInfo += ` + ${artwork.artist_proofs} AP`;
    }
  } else {
    editionInfo = artwork.classification || '';
  }
  
  return (
    <div className="space-y-3 font-sans text-sm p-4">
      {/* Artist Name (Header) */}
      <h1 className="font-bold text-lg mb-3">{artistName}</h1>

      {/* Artwork Image */}
      {artwork.image_url && (
        <div className="flex justify-center mb-4">
          <img 
            src={artwork.image_url} 
            alt={artwork.title} 
            className="max-h-64 w-auto object-contain border"
            crossOrigin="anonymous"
          />
        </div>
      )}
      {!artwork.image_url && (
        <div className="flex justify-center items-center mb-4 h-64 bg-gray-100 border">
           <span className="text-gray-400">No image available</span>
        </div>
      )}
      
      {/* Details Below Image */}
      <div className="space-y-1">
        {/* Repeated Artist Name */}
        <p><strong>{artistName}</strong></p>
        
        <p><strong>{artwork.title}{artwork.year ? `, ${artwork.year}` : ''}</strong></p>
        
        {artwork.materials && <p>{artwork.materials}</p>}
        
        {editionInfo && <p>{editionInfo}</p>}
        
        {artwork.height && artwork.width && (
          <p>{artwork.height} x {artwork.width}{artwork.depth ? ` x ${artwork.depth}` : ''} cm</p>
        )}
        
        {dimensionsInInches && (
          <p>{dimensionsInInches}</p>
        )}

        {artwork.medium_type && <p>{artwork.medium_type}</p>}
      </div>
    </div>
  );
}
