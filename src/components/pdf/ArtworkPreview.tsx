
import { Artwork } from "@/hooks/use-artworks";
import { cmToInchFraction } from "@/lib/pdf/unit-conversion";

interface ArtworkPreviewProps {
  artwork: Artwork;
}

export function ArtworkPDFPreview({ artwork }: ArtworkPreviewProps) {
  const artistName = artwork.artist_name || "Artist Name";
  
  let dimensionsInInches = '';
  if (artwork.height && artwork.width) {
    const heightInInches = cmToInchFraction(artwork.height);
    const widthInInches = cmToInchFraction(artwork.width);
    dimensionsInInches = artwork.depth 
      ? `${heightInInches} x ${widthInInches} x ${cmToInchFraction(artwork.depth)}"` 
      : `${heightInInches} x ${widthInInches}"`; // Corrected widthInches to widthInInches
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
  
  let formattedPriceDisplay = null;
  if (artwork.price !== null && artwork.currency) {
    try {
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: artwork.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(artwork.price);
      formattedPriceDisplay = <p className="mt-3"><strong>Price: {formatted}</strong></p>;
    } catch (e) {
      console.error("Error formatting price for preview:", e);
      formattedPriceDisplay = <p className="mt-3"><strong>Price: {artwork.price} {artwork.currency}</strong></p>;
    }
  }
  
  return (
    <div className="space-y-3 font-sans text-sm text-left"> {/* Ensure text-left for container */}
      {/* Artist Name (Header) */}
      <h1 className="font-bold text-lg mb-3">{artistName}</h1>

      {/* Artwork Image */}
      {artwork.image_url && (
        <div className="flex justify-start mb-4"> {/* Align image container to the left */}
          <img 
            src={artwork.image_url} 
            alt={artwork.title ?? "Artwork image"} 
            className="max-h-64 w-auto object-contain border" // w-auto helps maintain aspect ratio
            crossOrigin="anonymous"
          />
        </div>
      )}
      {!artwork.image_url && (
        <div className="flex justify-start items-center mb-4 h-64 bg-gray-100 border"> {/* Align placeholder to left */}
           <span className="text-gray-400">No image available</span>
        </div>
      )}
      
      {/* Details Below Image - Reduced spacing between caption lines */}
      <div className="space-y-0.5"> 
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

        {/* Price is now rendered here, after other details */}
        {formattedPriceDisplay}
      </div>
    </div>
  );
}
