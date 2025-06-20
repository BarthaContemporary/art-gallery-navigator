
import { Artwork } from "./types.ts";

export function generateHeaderContent(artworks: Artwork[]): string {
  let content = "ARTWORK LIST\n\n";
  content += `Date: ${new Date().toLocaleDateString()}\n`;
  content += `Total Artworks: ${artworks.length}\n`;
  return content;
}

export function generateArtworkContent(artwork: Artwork, index: number): string {
  let content = `${index}. `;
  
  // Artist name
  if (artwork.artist_name) {
    content += `${artwork.artist_name}\n`;
  } else {
    content += "Unknown Artist\n";
  }
  
  // Title and year
  const title = artwork.title || "Untitled";
  const year = artwork.year ? `, ${artwork.year}` : "";
  content += `${title}${year}\n`;
  
  // Medium and materials
  if (artwork.medium_type) {
    content += `${artwork.medium_type}`;
    if (artwork.materials) {
      content += `, ${artwork.materials}`;
    }
    content += "\n";
  } else if (artwork.materials) {
    content += `${artwork.materials}\n`;
  }
  
  // Dimensions
  if (artwork.dimensions) {
    content += `${artwork.dimensions}\n`;
  }
  
  // Price
  if (artwork.price) {
    content += `${artwork.currency} ${artwork.price.toLocaleString()}\n`;
  }
  
  // Status
  if (artwork.status) {
    content += `Status: ${artwork.status}\n`;
  }
  
  return content;
}
