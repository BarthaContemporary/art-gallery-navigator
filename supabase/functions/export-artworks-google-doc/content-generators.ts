
import { Artwork } from "./types.ts";

export function generateHeaderContent(artworks: Artwork[]): string {
  let content = "ARTWORK LIST\n\n";
  content += `Date: ${new Date().toLocaleDateString()}\n`;
  content += `Total Artworks: ${artworks.length}\n`;
  return content;
}

export function generateArtworkContent(artwork: Artwork, index: number): string {
  let content = `${index}. `;
  
  // 1. URL to public image of the artwork as HTML
  if ((artwork as any).primary_image_url) {
    content += `<a href="${(artwork as any).primary_image_url}">${(artwork as any).primary_image_url}</a>\n`;
  }
  
  // 2. Artist Name
  if (artwork.artist_name && artwork.artist_name.trim() !== '') {
    content += `${artwork.artist_name}\n`;
  } else {
    content += "Artist information not available\n";
  }
  
  // 3. Title + Year (on same line)
  const title = artwork.title || "Untitled";
  const year = artwork.year ? `, ${artwork.year}` : "";
  content += `${title}${year}\n`;
  
  // 4. Materials
  if (artwork.materials) {
    content += `${artwork.materials}\n`;
  }
  
  // 5. Dimensions
  if (artwork.dimensions) {
    content += `${artwork.dimensions}\n`;
  }
  
  // 6. Framed Dimensions
  const artworkAny = artwork as any;
  if (artworkAny.frame_width && artworkAny.frame_height) {
    let framedDimensions = `${artworkAny.frame_width} x ${artworkAny.frame_height}`;
    if (artworkAny.frame_depth) {
      framedDimensions += ` x ${artworkAny.frame_depth}`;
    }
    content += `Framed: ${framedDimensions} cm\n`;
  }
  
  // 7. AI Description (if available)
  if (artworkAny.ai_description) {
    content += `AI Description: ${artworkAny.ai_description}\n`;
  }
  
  // 8. Current Location
  if (artworkAny.location_name) {
    content += `Location: ${artworkAny.location_name}\n`;
  } else if (artwork.location_id) {
    content += `Location ID: ${artwork.location_id}\n`;
  }
  
  return content;
}
