
import { Artwork } from "@/hooks/use-artworks";
import { baseStyles, plainPaperStyles, getStationeryStyle } from "./styles";
import { cmToInchFraction } from "./unit-conversion";

export function generateArtworkHTML(
  artwork: Artwork,
  templateStyle: string = "basic",
  useStationery: boolean = false
): string {
  // Generate CSS for the template
  const stationeryStyle = getStationeryStyle(useStationery);
  const templateStyles = useStationery ? stationeryStyle : plainPaperStyles;
  
  // The path to the stationery image - used for direct image inclusion
  const stationeryImagePath = '/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png';
  
  // Generate HTML content based on artwork data
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${artwork.title || "Artwork"}</title>
      <style>
        ${baseStyles}
        ${templateStyles}
      </style>
    </head>
    <body>
      ${useStationery ? `<img src="${stationeryImagePath}" alt="Stationery" class="stationery-background-image" />` : ''}
      
      <div class="content-wrapper">
        <img src="${artwork.image_url || '/placeholder.svg'}" alt="${artwork.title || 'Artwork'}" class="artwork-image" />
        
        <p class="artist-name">${artwork.artist_name || 'Artist Name'}</p>
        <p class="artwork-title">${artwork.title}${artwork.year ? ', ' + artwork.year : ''}</p>
        
        ${artwork.materials ? `<p class="materials">${artwork.materials}</p>` : ''}
        
        ${artwork.edition_size && artwork.edition_size > 1 
          ? `<p class="edition-details">Edition of ${artwork.edition_size}${artwork.artist_proofs 
              ? ' + ' + artwork.artist_proofs + ' AP'
              : ''}</p>`
          : '<p class="edition-details">Unique</p>'}
        
        ${artwork.dimensions 
          ? `<p class="dimensions">${artwork.dimensions}</p>`
          : ''}
        
        ${artwork.height && artwork.width 
          ? `<p class="dimensions">${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm</p>` 
          : ''}
        
        ${artwork.height && artwork.width 
          ? `<p class="dimensions">${cmToInchFraction(artwork.height)} x ${cmToInchFraction(artwork.width)}${artwork.depth 
              ? ' x ' + cmToInchFraction(artwork.depth)
              : ''}"</p>` 
          : ''}
        
        ${artwork.is_framed && artwork.frame_height && artwork.frame_width 
          ? `<p class="frame-dimensions">Frame: ${artwork.frame_height} x ${artwork.frame_width}${artwork.frame_depth 
              ? ' x ' + artwork.frame_depth 
              : ''} cm</p>` 
          : ''}
        
        ${artwork.is_framed && artwork.frame_height && artwork.frame_width 
          ? `<p class="frame-dimensions">Frame: ${cmToInchFraction(artwork.frame_height)} x ${cmToInchFraction(artwork.frame_width)}${artwork.frame_depth 
              ? ' x ' + cmToInchFraction(artwork.frame_depth)
              : ''}"</p>` 
          : ''}
        
        ${(templateStyle === 'basicWithPrice' || templateStyle === 'complete') && artwork.price 
          ? `<p class="price">${artwork.currency || '£'} ${artwork.price.toLocaleString()}</p>`
          : ''}
        
        ${templateStyle === 'complete' && artwork.story 
          ? `
          <h2>Story</h2>
          <p class="artwork-story">${artwork.story}</p>
          `
          : ''}
        
        ${templateStyle === 'complete' && artwork.provenance 
          ? `
          <h2>Provenance</h2>
          <p class="artwork-provenance">${artwork.provenance}</p>
          `
          : ''}
        
        ${templateStyle === 'complete' && artwork.exhibition_history 
          ? `
          <h2>Exhibition History</h2>
          <p class="artwork-exhibition-history">${artwork.exhibition_history}</p>
          `
          : ''}
      </div>
    </body>
    </html>
  `;
}
