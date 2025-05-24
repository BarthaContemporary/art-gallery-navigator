
import { Artwork } from "@/hooks/use-artworks";
import { escapeHtml } from "./utils";
import { cmToInchFraction } from "./unit-conversion";

/**
 * Generates the HTML for the artwork details section.
 */
export function generateArtworkDetails(artwork: Artwork, artistName: string): string {
  const artworkTitle = escapeHtml(artwork.title || 'Untitled');
  const artworkYear = artwork.year ? `, ${artwork.year}` : '';
  
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

  let priceHtml = '';
  if (artwork.price !== null && artwork.currency) {
    try {
      const formattedPrice = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: artwork.currency, 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }).format(artwork.price);
      // Adjusted margin-top for one line space before price
      priceHtml = `<p style="margin-top: 0.35cm;"><strong>Price: ${escapeHtml(formattedPrice)}</strong></p>`;
    } catch (e) {
      console.error("Error formatting price for PDF:", e);
      // Fallback to simple display if formatting fails, with adjusted margin-top
      priceHtml = `<p style="margin-top: 0.35cm;"><strong>Price: ${escapeHtml(String(artwork.price))} ${escapeHtml(artwork.currency)}</strong></p>`;
    }
  }

  return `
    ${repeatedArtistNameHtml}
    ${titleYear}
    ${materials}
    ${editionInfo}
    ${dimensionsCm}
    ${dimensionsInches}
    ${mediumType}
    ${priceHtml}
  `;
}
