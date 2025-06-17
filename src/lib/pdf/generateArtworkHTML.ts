
import { Artwork } from "@/hooks/use-artworks";
import { baseStyles } from "./base-styles";
import { getStationeryStyle, getStationeryBackgroundHTML } from "./stationery-utils";
import { escapeHtml, preloadImage } from "./utils";
import { artworkPdfStyles } from "./artwork-pdf-styles";
import { generateArtworkDetails } from "./artwork-pdf-utils";

/**
 * Generates complete HTML for artwork PDF
 */
export async function generateArtworkHTML(
  artwork: Artwork,
  useStationery: boolean = true,
  artistName?: string // Add artistName parameter
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
  
  // Preload stationery background if used
  if (useStationery) {
    try {
      await preloadImage("/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png");
      console.log("Stationery image preloaded for artwork PDF");
    } catch (error) {
      console.error("Error preloading stationery image for artwork PDF:", error);
    }
  }
  
  // Use the provided artistName, fallback to artwork.artist_name, then to 'Unknown Artist'
  const resolvedArtistName = escapeHtml(artistName || artwork.artist_name || 'Unknown Artist'); 
    
  const stationerySpecificStyles = getStationeryStyle(useStationery); 
  const stationeryBackground = useStationery ? getStationeryBackgroundHTML() : ''; 
  
  const artworkImageHtml = artwork.image_url 
    ? `<div class="artwork-image-container">
         <img 
           src="${artwork.image_url}" 
           alt="${escapeHtml(artwork.title || 'Artwork')}" 
           class="artwork-image"
           crossorigin="anonymous"
         />
       </div>`
    : '<div class="artwork-image-container" style="height: 400px; display: flex; align-items: center; justify-content: flex-start; border: 1px dashed #ccc; margin-bottom: 1cm;"><p style="padding-left: 1cm;">No image available</p></div>'; 
  
  const detailsHtml = generateArtworkDetails(artwork, resolvedArtistName);
  
  const contentWrapperPadding = useStationery ? "padding: 7cm 2cm 2cm 2cm;" : "padding: 2cm;";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(artwork.title || 'Artwork')}</title>
      <style>
        /* Base styles common to all PDF types */
        ${baseStyles}
        
        /* Styles specific to artwork PDF */
        ${artworkPdfStyles}
        
        /* Stationery styles if enabled (could override/complement artworkPdfStyles) */
        ${stationerySpecificStyles}

        /* Dynamic content wrapper style, especially padding */
        .content-wrapper {
          ${contentWrapperPadding}
          /* Other .content-wrapper styles like position, z-index, box-sizing are in artworkPdfStyles */
        }
      </style>
    </head>
    <body>
      ${stationeryBackground}
      
      <div class="content-wrapper">
        <div class="artist-name-header">${resolvedArtistName}</div>
        
        ${artworkImageHtml}
        
        <div class="artwork-details">
          ${detailsHtml}
        </div>
      </div>
    </body>
    </html>
  `;
  
  console.log("Artwork HTML generation complete");
  return html;
}
