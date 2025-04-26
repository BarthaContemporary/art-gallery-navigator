
import { Artwork } from "@/hooks/use-artworks";
import { escapeHtml } from "./utils";
import { 
  baseStyles, 
  plainPaperStyles, 
  stationeryStyles, 
  getStationeryStyle, 
  cmToInchFraction 
} from "./styles";

export function generateArtworkHTML(
  artwork: Artwork, 
  templateStyle: string = 'basic',
  useStationery: boolean = false
): string {
  // Get artist name if available (assuming we have artist data)
  const artistName = artwork.artist_id ? "Artist Name" : "Unknown Artist"; // Replace with actual artist name when available
  
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
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Artwork: ${escapeHtml(artwork.title)}</title>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap">
        <style>
          ${baseStyles}
          ${useStationery ? stationeryStyles : plainPaperStyles}
          ${getStationeryStyle(useStationery)}
        </style>
      </head>
      <body>
        <div class="content-wrapper">
          ${useStationery ? `<div class="artist-name-header">${escapeHtml(artistName)}</div>` : ''}
          
          ${artwork.image_url ? `<img src="${escapeHtml(artwork.image_url)}" class="artwork-image" alt="${escapeHtml(artwork.title)}" />` : ''}
          
          <div class="artist-name">${escapeHtml(artistName)}</div>
          <div class="artwork-title">${escapeHtml(artwork.title)}${artwork.year ? `, ${artwork.year}` : ''}</div>
          
          ${artwork.materials ? `<div class="materials">${escapeHtml(artwork.materials)}</div>` : ''}
          ${artwork.edition_size && artwork.edition_size > 1 ? `<div class="edition-details">${editionInfo}</div>` : ''}
          
          ${artwork.dimensions ? `
            <div class="dimensions">${escapeHtml(artwork.dimensions)}</div>
            ${dimensionsInInches ? `<div class="dimensions">${dimensionsInInches}</div>` : ''}
          ` : ''}
          
          ${artwork.is_framed && artwork.frame_height && artwork.frame_width ? `
            <div class="frame-dimensions">Frame: ${artwork.frame_height} x ${artwork.frame_width}${artwork.frame_depth ? ` x ${artwork.frame_depth}` : ''} cm</div>
            ${frameDimensionsInInches ? `<div class="frame-dimensions">Frame: ${frameDimensionsInInches}</div>` : ''}
          ` : ''}
          
          ${(templateStyle === 'basicWithPrice' || templateStyle === 'complete') && artwork.price ? `
            <div class="price">${artwork.currency} ${artwork.price.toLocaleString()}</div>
          ` : ''}
          
          ${templateStyle === 'complete' ? `
            ${artwork.status ? `<div class="status">Status: ${escapeHtml(artwork.status)}</div>` : ''}
            ${artwork.location_id ? `<div class="location">Location: Location Name</div>` : ''}
            
            ${artwork.story ? `
              <div class="story">
                <h3>Story:</h3>
                <div>${escapeHtml(artwork.story)}</div>
              </div>
            ` : ''}
            
            ${artwork.provenance ? `
              <div class="provenance">
                <h3>Provenance:</h3>
                <div>${escapeHtml(artwork.provenance)}</div>
              </div>
            ` : ''}
            
            ${artwork.exhibition_history ? `
              <div class="exhibition-history">
                <h3>Exhibition History:</h3>
                <div>${escapeHtml(artwork.exhibition_history)}</div>
              </div>
            ` : ''}
          ` : ''}
        </div>
      </body>
    </html>
  `;
}

