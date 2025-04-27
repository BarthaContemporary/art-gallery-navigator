
import { Artwork } from "@/hooks/use-artworks";
import { baseStyles } from "./base-styles";
import { getStationeryStyle, getStationeryBackgroundHTML } from "./stationery-utils";
import { cmToInchFraction } from "./unit-conversion";
import { escapeHtml, createImageTag, preloadImage } from "./utils";

/**
 * Generates complete HTML for artwork PDF
 */
export async function generateArtworkHTML(
  artwork: Artwork,
  templateStyle: string = "classic",
  useStationery: boolean = false
): Promise<string> {
  console.log(`Generating HTML for artwork: ${artwork.title}, template: ${templateStyle}, stationery: ${useStationery}`);
  
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
  const artworkTitle = escapeHtml(artwork.title || 'Untitled');
  const artworkYear = artwork.year ? `, ${artwork.year}` : '';
  
  // Get styles
  const stationeryStyle = getStationeryStyle(useStationery);
  
  // Generate stationery background HTML if needed
  const stationeryBackground = useStationery ? getStationeryBackgroundHTML() : '';
  
  // Generate artwork image HTML if available
  const artworkImageHtml = artwork.image_url 
    ? `<div class="artwork-image-container">
         <img 
           src="${artwork.image_url}" 
           alt="${escapeHtml(artwork.title || 'Artwork')}" 
           class="artwork-image"
           crossorigin="anonymous"
           style="max-width: 100%; max-height: 40%; object-fit: contain; margin-bottom: 1cm;"
         />
       </div>`
    : '';
  
  // Generate details for the artwork
  const details = generateArtworkDetails(artwork, templateStyle);
  
  // Generate artwork header based on template style
  const header = generateArtworkHeader(artwork, templateStyle);
  
  // Generate template-specific styles
  const templateStyles = getTemplateStyles(templateStyle);
  
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
        
        /* Template-specific styles */
        ${templateStyles}
        
        /* Additional styles for PDF optimization */
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        
        .artwork-image {
          max-width: 80%;
          max-height: 40%;
          object-fit: contain;
          margin: 0 auto 1cm auto;
        }
        
        .artwork-image-container {
          text-align: center;
          margin-bottom: 1cm;
        }
      </style>
    </head>
    <body>
      ${stationeryBackground}
      
      <div class="content-wrapper">
        ${header}
        
        ${artworkImageHtml}
        
        <div class="artwork-details">
          <p class="artist-name">${artistName}</p>
          <p class="artwork-title">${artworkTitle}${artworkYear}</p>
          
          ${details}
        </div>
      </div>
    </body>
    </html>
  `;
  
  console.log("HTML generation complete");
  return html;
}

/**
 * Generates the header section based on template style
 */
function generateArtworkHeader(artwork: Artwork, templateStyle: string): string {
  switch (templateStyle) {
    case "classic":
      return `
        <div class="classic-header">
          <h1>${escapeHtml(artwork.title || 'Artwork')}</h1>
        </div>
      `;
    case "modern":
      return `
        <div class="modern-header">
          <h1>${escapeHtml(artwork.title || 'Artwork')}</h1>
          <div class="accent-line"></div>
        </div>
      `;
    case "minimal":
      return `
        <div class="minimal-header">
          <h1>${escapeHtml(artwork.title || 'Artwork').toUpperCase()}</h1>
        </div>
      `;
    default:
      return '';
  }
}

/**
 * Generates the details section for the artwork
 */
function generateArtworkDetails(artwork: Artwork, templateStyle: string): string {
  // Format materials info
  const materials = artwork.materials 
    ? `<p>${escapeHtml(artwork.materials)}</p>` 
    : '';
  
  // Format edition info
  let editionInfo = '';
  if (artwork.edition_size && artwork.edition_size > 1) {
    editionInfo = `<p>Edition of ${artwork.edition_size}${
      artwork.artist_proofs ? ' + ' + artwork.artist_proofs + ' AP' : ''
    }</p>`;
  } else {
    editionInfo = '<p>Unique</p>';
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
  
  // Format frame dimensions in cm if applicable
  const frameDimensionsCm = artwork.is_framed && artwork.frame_height && artwork.frame_width 
    ? `<p>Frame: ${artwork.frame_height} x ${artwork.frame_width}${
        artwork.frame_depth ? ' x ' + artwork.frame_depth : ''
      } cm</p>` 
    : '';
  
  // Format frame dimensions in inches if applicable
  const frameDimensionsInches = artwork.is_framed && artwork.frame_height && artwork.frame_width 
    ? `<p>Frame: ${cmToInchFraction(artwork.frame_height)} x ${cmToInchFraction(artwork.frame_width)}${
        artwork.frame_depth ? ' x ' + cmToInchFraction(artwork.frame_depth) : ''
      }"</p>` 
    : '';
  
  // Include price if template requires it
  const priceInfo = (templateStyle === 'modern' || templateStyle === 'minimal') && artwork.price 
    ? `<p class="price">${artwork.currency || '£'} ${artwork.price.toLocaleString()}</p>` 
    : '';
  
  // Additional sections for complete template
  let additionalSections = '';
  if (templateStyle === 'minimal') {
    // Story section
    if (artwork.story) {
      additionalSections += `
        <div class="section">
          <h2>Story</h2>
          <p>${escapeHtml(artwork.story)}</p>
        </div>
      `;
    }
    
    // Provenance section
    if (artwork.provenance) {
      additionalSections += `
        <div class="section">
          <h2>Provenance</h2>
          <p>${escapeHtml(artwork.provenance)}</p>
        </div>
      `;
    }
    
    // Exhibition history section
    if (artwork.exhibition_history) {
      additionalSections += `
        <div class="section">
          <h2>Exhibition History</h2>
          <p>${escapeHtml(artwork.exhibition_history)}</p>
        </div>
      `;
    }
  }
  
  // Combine all details
  return `
    <div class="basic-details">
      ${materials}
      ${editionInfo}
      ${dimensionsCm}
      ${dimensionsInches}
      ${frameDimensionsCm}
      ${frameDimensionsInches}
      ${priceInfo}
    </div>
    ${additionalSections}
  `;
}

/**
 * Returns CSS styles specific to the template
 */
function getTemplateStyles(templateStyle: string): string {
  switch (templateStyle) {
    case "classic":
      return `
        .classic-header {
          border-bottom: 2px solid #333;
          margin-bottom: 1.5cm;
          padding-bottom: 0.5cm;
        }
        
        .classic-header h1 {
          color: #18465a;
        }
      `;
    case "modern":
      return `
        .modern-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5cm;
        }
        
        .accent-line {
          width: 5cm;
          height: 3px;
          background-color: #18465a;
        }
        
        .artwork-details {
          padding-left: 0.5cm;
          border-left: 3px solid #18465a;
        }
      `;
    case "minimal":
      return `
        .minimal-header h1 {
          font-size: 16pt;
          font-weight: 400;
          letter-spacing: 0.2cm;
          margin-bottom: 2cm;
        }
        
        .section {
          margin-top: 1.5cm;
        }
      `;
    default:
      return '';
  }
}
