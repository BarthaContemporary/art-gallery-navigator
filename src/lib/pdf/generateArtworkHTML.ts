
import { Artwork } from "@/hooks/use-artworks";
import { baseStyles } from "./base-styles";
import { getStationeryStyle, getStationeryBackgroundHTML } from "./stationery-utils";
import { cmToInchFraction } from "./unit-conversion";
import { escapeHtml, preloadImage } from "./utils";

/**
 * Generates complete HTML for artwork PDF
 */
export async function generateArtworkHTML(
  artwork: Artwork,
  useStationery: boolean = true // Default to true, effectively always on
): Promise<string> {
  console.log(`Generating HTML for artwork: ${artwork.title}, stationery: ${useStationery}`);
  
  if (artwork.image_url) {
    console.log(`Preloading artwork image: ${artwork.image_url}`);
    try {
      await preloadImage(artwork.image_url);
    } catch (error) {
      console.error("Error preloading artwork image:", error);
    }
  }
  
  const artistName = escapeHtml(artwork.artist_name || 'Artist Name'); // Use artwork.artist_name
    
  const stationeryStyle = getStationeryStyle(useStationery); 
  const stationeryBackground = useStationery ? getStationeryBackgroundHTML() : ''; 
  
  const artworkImageHtml = artwork.image_url 
    ? `<div class="artwork-image-container">
         <img 
           src="${artwork.image_url}" 
           alt="${escapeHtml(artwork.title || 'Artwork')}" 
           class="artwork-image"
           crossorigin="anonymous"
           style="max-width: 100%; max-height: 400px; object-fit: contain; margin-bottom: 1cm;" 
         />
       </div>`
    : '<div class="artwork-image-container" style="height: 400px; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; margin-bottom: 1cm;"><p>No image available</p></div>';
  
  // Pass artistName to generateArtworkDetails for repetition
  const detailsHtml = generateArtworkDetails(artwork, artistName);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(artwork.title || 'Artwork')}</title>
      <style>
        /* Ensure A4 page size */
        @page {
          size: A4;
          margin: 0; 
        }

        body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
          position: relative; /* For stationery background */
        }

        ${baseStyles}
        ${stationeryStyle}
        
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        
        .artwork-image {
          max-width: 100%;
          max-height: 400px; 
          object-fit: contain;
          margin: 0 auto 1cm auto;
        }
        
        .artwork-image-container {
          text-align: center;
          margin-bottom: 1cm;
        }

        .artist-name-header {
          font-size: 18pt; /* Or adjust as needed */
          font-weight: bold;
          margin-bottom: 0.5cm; /* Or adjust */
          text-align: left; 
        }

        .artwork-details p {
          margin-bottom: 0.3cm; 
          font-size: 10pt; 
        }

        .content-wrapper {
          /* Applied padding-top: 13cm to move content down by approx 500px. */
          /* This is a large offset and might push content off-page or require adjustments */
          /* to other elements or the stationery design. */
          padding: 13cm 2cm 2cm 2cm; /* Top, Right, Bottom, Left. Adjusted side/bottom padding for balance */
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }
      </style>
    </head>
    <body>
      ${stationeryBackground}
      
      <div class="content-wrapper">
        <div class="artist-name-header">${artistName}</div>
        
        ${artworkImageHtml}
        
        <div class="artwork-details">
          ${detailsHtml}
        </div>
      </div>
    </body>
    </html>
  `;
  
  console.log("HTML generation complete");
  return html;
}

/**
 * Generates the details section for the artwork
 */
function generateArtworkDetails(artwork: Artwork, artistName: string): string { // Added artistName parameter
  const artworkTitle = escapeHtml(artwork.title || 'Untitled');
  const artworkYear = artwork.year ? `, ${artwork.year}` : '';
  
  // Repeated Artist Name
  const repeatedArtistNameHtml = `<p><strong>${artistName}</strong></p>`;
  
  const titleYear = `<p><strong>${artworkTitle}${artworkYear}</strong></p>`;

  const materials = artwork.materials 
    ? `<p>${escapeHtml(artwork.materials)}</p>` 
    : '';
  
  let editionInfo = '';
  if (artwork.classification === 'Unique') {
    editionInfo = '<p>Unique</p>';
  } else if (artwork.edition_size) {
    editionInfo = `<p>Edition of ${artwork.edition_size}${
      artwork.artist_proofs ? ' + ' + artwork.artist_proofs + ' AP' : ''
    }</p>`;
  } else {
    editionInfo = artwork.classification ? `<p>${escapeHtml(artwork.classification)}</p>` : '';
  }
  
  const dimensionsCm = artwork.height && artwork.width 
    ? `<p>${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm</p>` 
    : '';
  
  const dimensionsInches = artwork.height && artwork.width 
    ? `<p>${cmToInchFraction(artwork.height)} x ${cmToInchFraction(artwork.width)}${
        artwork.depth ? ' x ' + cmToInchFraction(artwork.depth) : ''
      }"</p>` 
    : '';
  
  const mediumType = artwork.medium_type ? `<p>${escapeHtml(artwork.medium_type)}</p>` : '';

  return `
    ${repeatedArtistNameHtml} {/* Added repeated artist name */}
    ${titleYear}
    ${materials}
    ${editionInfo}
    ${dimensionsCm}
    ${dimensionsInches}
    ${mediumType}
  `;
}
