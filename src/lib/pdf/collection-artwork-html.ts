
import { formatArtworkPrice, formatDimensions, getEditionInfo } from "./collection-pdf-utils";
import { escapeHtml } from "./utils";

/**
 * Generates HTML for a single artwork within a collection PDF
 */
export function generateArtworkHTML(
  artwork: any, 
  artistName: string, 
  isFirstArtwork: boolean, 
  collectionHeaderHTML: string
): string {
  // Prepare image HTML with proper attributes
  const imageHtml = artwork.image_url 
    ? `<img 
        src="${artwork.image_url}" 
        alt="${escapeHtml(artwork.title)}" 
        class="artwork-image" 
        crossorigin="anonymous"
      />`
    : `<div class="image-placeholder">No image available</div>`;
  
  // Get dimensions formatted in cm and inches
  const { dimensionsCm, dimensionsInches } = formatDimensions(
    artwork.height, 
    artwork.width, 
    artwork.depth
  );
  
  // Get edition information
  const editionInfo = getEditionInfo(
    artwork.classification, 
    artwork.edition_size,
    artwork.artist_proofs
  );
  
  // Format price with proper spacing
  let priceHtml = '';
  if (artwork.price !== null && artwork.currency) {
    const formattedPrice = formatArtworkPrice(artwork.price, artwork.currency);
    priceHtml = `<p class="price">${escapeHtml(formattedPrice)}</p>`;
  }
  
  // First artwork includes collection info, others are standalone pages
  // Add more explicit page break styling for non-first artworks
  const pageClass = isFirstArtwork ? 'first-artwork' : 'artwork-page';
  const explicitPageBreakStyle = !isFirstArtwork 
    ? 'style="page-break-before: always; break-before: page;"' 
    : '';
  const includeCollectionInfo = isFirstArtwork ? collectionHeaderHTML : '';
  
  return `
    <div class="${pageClass}" ${explicitPageBreakStyle} data-force-page-break="${!isFirstArtwork}">
      ${includeCollectionInfo}
      
      <div class="artist-name-header">${escapeHtml(artistName)}</div>
      
      <div class="artwork-image-container">
        ${imageHtml}
      </div>
      
      <div class="artwork-details">
        <p class="artist-name"><strong>${escapeHtml(artistName)}</strong></p>
        <p class="artwork-title"><strong>${escapeHtml(artwork.title || 'Untitled')}${artwork.year ? ', ' + artwork.year : ''}</strong></p>
        ${artwork.materials ? `<p class="materials">${escapeHtml(artwork.materials)}</p>` : ''}
        ${editionInfo ? `<p class="edition-details">${escapeHtml(editionInfo)}</p>` : ''}
        ${dimensionsCm ? `<p class="dimensions">${dimensionsCm}</p>` : ''}
        ${dimensionsInches ? `<p class="dimensions">${dimensionsInches}</p>` : ''}
        ${artwork.medium_type ? `<p class="medium-type">${escapeHtml(artwork.medium_type)}</p>` : ''}
        ${priceHtml}
      </div>
    </div>
  `;
}
