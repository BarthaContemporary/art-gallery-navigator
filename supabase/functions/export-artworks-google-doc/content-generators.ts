
import { Artwork } from "./types.ts";

export function generateHeaderContent(artworks: Artwork[]): string {
  let content = "ARTWORK LIST\n\n";
  content += `Date: ${new Date().toLocaleDateString()}\n`;
  content += `Total Artworks: ${artworks.length}\n`;
  return content;
}

export function generateArtworkContent(artwork: Artwork, index: number): string {
  let content = `${index}. `;
  
  // Add =IMAGE() function if primary image URL is available
  if ((artwork as any).primary_image_url) {
    content += `=IMAGE("${(artwork as any).primary_image_url}")\n`;
  }
  
  // Artist name - improved logic to handle artist_name field properly
  if (artwork.artist_name && artwork.artist_name.trim() !== '') {
    content += `${artwork.artist_name}\n`;
  } else {
    content += "Artist information not available\n";
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
