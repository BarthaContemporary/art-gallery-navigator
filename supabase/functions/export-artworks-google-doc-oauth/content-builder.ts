
/**
 * Google Docs content building utilities with proper indexing
 */

export interface ContentBlock {
  type: 'text' | 'image';
  content: string;
  imageUrl?: string;
}

export interface BatchRequest {
  insertText?: {
    location: { index: number };
    text: string;
  };
  insertInlineImage?: {
    location: { index: number };
    uri: string;
    objectSize: {
      height: { magnitude: number; unit: string };
      width: { magnitude: number; unit: string };
    };
  };
}

export function buildArtworkTextContent(artwork: any, index: number, locationName?: string): string {
  let content = `Artwork ${index}\n\n`;
  
  // Artist Name
  if (artwork.artist_name && artwork.artist_name.trim() !== '') {
    content += `Artist: ${artwork.artist_name}\n`;
  } else {
    content += "Artist: Information not available\n";
  }
  
  // Title + Year
  const title = artwork.title || "Untitled";
  const year = artwork.year ? `, ${artwork.year}` : "";
  content += `Title: ${title}${year}\n`;
  
  // Materials
  if (artwork.materials) {
    content += `Materials: ${artwork.materials}\n`;
  }
  
  // Dimensions
  if (artwork.dimensions) {
    content += `Dimensions: ${artwork.dimensions}\n`;
  }
  
  // Price
  if (artwork.price && artwork.currency) {
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: artwork.currency,
      minimumFractionDigits: 0
    }).format(artwork.price);
    content += `Price: ${formattedPrice}\n`;
  }
  
  // Framed Dimensions
  if (artwork.frame_width && artwork.frame_height) {
    let framedDimensions = `${artwork.frame_width} x ${artwork.frame_height}`;
    if (artwork.frame_depth) {
      framedDimensions += ` x ${artwork.frame_depth}`;
    }
    content += `Framed: ${framedDimensions} cm\n`;
  }
  
  // AI Description
  if (artwork.ai_description) {
    content += `Description: ${artwork.ai_description}\n`;
  }
  
  // Location
  if (locationName) {
    content += `Location: ${locationName}\n`;
  }

  return content;
}

export function buildBatchRequests(
  artworks: any[], 
  locationMap: Map<string, string>,
  imageResults: Map<string, { url: string; source: string }>
): BatchRequest[] {
  const requests: BatchRequest[] = [];
  let currentIndex = 1; // Start after the default paragraph

  // Add header
  const headerText = `ARTWORK EXPORT\n\nDate: ${new Date().toLocaleDateString()}\nTotal Artworks: ${artworks.length}\n\n`;
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: headerText
    }
  });
  currentIndex += headerText.length;

  // Process each artwork
  for (let i = 0; i < artworks.length; i++) {
    const artwork = artworks[i];
    const locationName = artwork.location_id ? locationMap.get(artwork.location_id) : undefined;
    
    // Add artwork text content
    const textContent = buildArtworkTextContent(artwork, i + 1, locationName);
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: textContent
      }
    });
    currentIndex += textContent.length;

    // Add image if available
    const imageResult = imageResults.get(artwork.id);
    if (imageResult) {
      // Add a line break before image
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: "\n"
        }
      });
      currentIndex += 1;

      // Insert image
      requests.push({
        insertInlineImage: {
          location: { index: currentIndex },
          uri: imageResult.url,
          objectSize: {
            height: { magnitude: 200, unit: "PT" },
            width: { magnitude: 200, unit: "PT" }
          }
        }
      });
      currentIndex += 1;
    } else {
      // Add placeholder text for missing image
      const placeholderText = "[Image not available]\n";
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: placeholderText
        }
      });
      currentIndex += placeholderText.length;
    }

    // Add spacing between artworks (except for the last one)
    if (i < artworks.length - 1) {
      const spacing = "\n" + "─".repeat(50) + "\n\n";
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: spacing
        }
      });
      currentIndex += spacing.length;
    }
  }

  return requests;
}
