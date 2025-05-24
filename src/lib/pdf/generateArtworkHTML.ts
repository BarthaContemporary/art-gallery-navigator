
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
  // templateStyle: string = "classic", // Removed: templateStyle is no longer used
  useStationery: boolean = true // Default to true, effectively always on
): Promise<string> {
  console.log(`Generating HTML for artwork: ${artwork.title}, stationery: ${useStationery}`);
  
  // Preload artwork image if available
  if (artwork.image_url) {
    console.log(`Preloading artwork image: ${artwork.image_url}`);
    try {
      await preloadImage(artwork.image_url);
    } catch (error) {
      console.error("Error preloading artwork image:", error);
    }
  }
  
  // Format artwork information safely
  const artistName = escapeHtml(artwork.artist_name || 'Artist Name');
    
  // Get styles
  const stationeryStyle = getStationeryStyle(useStationery); // useStationery will always be true
  
  // Generate stationery background HTML if needed
  const stationeryBackground = useStationery ? getStationeryBackgroundHTML() : ''; // Will always generate
  
  // Generate artwork image HTML if available
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
  
  // Generate details for the artwork
  const detailsHtml = generateArtworkDetails(artwork);
  
  // Generate complete HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(artwork.title || 'Artwork')}</title>
      <style>
        /* Base styles */
        ${baseStyles}
        
        /* Stationery styles if enabled */
        ${stationeryStyle}
        
        /* Additional styles for PDF optimization */
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        
        .artwork-image {
          max-width: 100%; /* Changed from 80% */
          max-height: 400px; /* Fixed max height for image */
          object-fit: contain;
          margin: 0 auto 1cm auto;
        }
        
        .artwork-image-container {
          text-align: center;
          margin-bottom: 1cm;
        }

        .artist-name-header {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 0.5cm;
          text-align: left; /* Or center, depending on desired look with stationery */
        }

        .artwork-details p {
          margin-bottom: 0.3cm; /* Spacing between detail lines */
          font-size: 10pt; /* Consistent font size for details */
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

// Removed generateArtworkHeader function as it's no longer needed.
// Removed getTemplateStyles function as it's no longer needed.

/**
 * Generates the details section for the artwork (Title, Year, Materials, Edition, Dimensions, Medium Type)
 */
function generateArtworkDetails(artwork: Artwork): string {
  const artworkTitle = escapeHtml(artwork.title || 'Untitled');
  const artworkYear = artwork.year ? `, ${artwork.year}` : '';
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
    // Fallback for non-unique items without edition size
    editionInfo = artwork.classification ? `<p>${escapeHtml(artwork.classification)}</p>` : '';
  }
  
  // Format dimensions in cm
  const dimensionsCm = artwork.height && artwork.width 
    ? `<p>${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm</p>` 
    : '';
  
  // Format dimensions in inches
  const dimensionsInches = artwork.height && artwork.width 
    ? `<p>${cmToInchFraction(artwork.height)} x ${cmToInchFraction(artwork.width)}${
        artwork.depth ? ' x ' + cmToInchFraction(artwork.depth) : ''
      }"</p>` 
    : '';
  
  const mediumType = artwork.medium_type ? `<p>${escapeHtml(artwork.medium_type)}</p>` : '';

  // Price is no longer part of this simplified template based on the request.
  // If price is needed, it should be added here.
  // const priceInfo = artwork.price
  //   ? `<p class="price">${artwork.currency || '£'} ${artwork.price.toLocaleString()}</p>`
  //   : '';

  // Story, Provenance, Exhibition History are no longer part of this simplified template based on the request.
  // If these are needed, they should be added here.

  return `
    ${titleYear}
    ${materials}
    ${editionInfo}
    ${dimensionsCm}
    ${dimensionsInches}
    ${mediumType}
  `;
}

