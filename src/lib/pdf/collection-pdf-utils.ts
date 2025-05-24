
import { Collection } from "@/hooks/use-collections";
import { escapeHtml } from "./utils";

/**
 * Generates the collection header HTML with name and description
 */
export function generateCollectionHeaderHTML(collection: Collection): string {
  return `
    <div class="collection-name">${escapeHtml(collection.name)}</div>
    ${collection.description ? `<p class="collection-description">${escapeHtml(collection.description)}</p>` : ''}
  `;
}

/**
 * Formats price for display with proper currency formatting
 */
export function formatArtworkPrice(price: number | null, currency: string | null): string {
  if (price === null || !currency) return '';
  
  try {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency, 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(price);
  } catch (e) {
    console.error("Error formatting price for PDF:", e);
    // Fallback display
    return `${String(price)} ${currency}`;
  }
}

/**
 * Formats artwork dimensions in both cm and inches
 */
export function formatDimensions(height?: number, width?: number, depth?: number) {
  if (!height || !width) return { dimensionsCm: '', dimensionsInches: '' };
  
  const dimensionsCm = `${height} x ${width}${depth ? ' x ' + depth : ''} cm`;
  
  // Import needed here to avoid circular dependencies
  const { cmToInchFraction } = require('./unit-conversion');
  const dimensionsInches = `${cmToInchFraction(height)} x ${cmToInchFraction(width)}${
    depth ? ' x ' + cmToInchFraction(depth) : ''
  }"`;
  
  return { dimensionsCm, dimensionsInches };
}

/**
 * Gets the edition information string for an artwork
 */
export function getEditionInfo(classification?: string, editionSize?: number, artistProofs?: number): string {
  if (classification === 'Unique') {
    return 'Unique';
  } else if (editionSize) {
    return `Edition of ${editionSize}${
      artistProofs ? ' + ' + artistProofs + ' AP' : ''
    }`;
  } else if (classification) {
    return classification;
  }
  return '';
}
