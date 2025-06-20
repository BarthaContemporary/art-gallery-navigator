
import { Artwork } from "./types.ts";
import { insertTextAtIndex, insertImageAtIndex } from "./document-operations.ts";
import { generateHeaderContent, generateArtworkContent } from "./content-generators.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";

export async function processDocumentContent(
  documentId: string, 
  accessToken: string, 
  artworks: Artwork[]
): Promise<void> {
  // Get the document content to find where to insert the artwork list
  console.log("Getting document content to find insertion point...");
  const getDocResponse = await fetch(`${GOOGLE_API_URL}/${documentId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    }
  });

  if (!getDocResponse.ok) {
    const errorText = await getDocResponse.text();
    console.error("Failed to get document content:", getDocResponse.status, errorText);
    throw new Error(`Failed to get document content: ${getDocResponse.status} - ${errorText}`);
  }

  const docContent = await getDocResponse.json();
  let currentIndex = docContent.body.content[docContent.body.content.length - 1].endIndex - 1;

  // Insert header content
  console.log("Inserting header content...");
  const headerContent = generateHeaderContent(artworks);
  await insertTextAtIndex(documentId, accessToken, currentIndex, "\n\n" + headerContent);
  currentIndex += headerContent.length + 2;

  // Process each artwork with images BEFORE text content
  for (let i = 0; i < artworks.length; i++) {
    const artwork = artworks[i];
    console.log(`Processing artwork ${i + 1}: ${artwork.title}`);
    
    // Insert image FIRST if available
    if (artwork.artwork_images && artwork.artwork_images.length > 0) {
      const primaryImage = artwork.artwork_images.find(img => img.is_primary);
      const imageToUse = primaryImage || artwork.artwork_images[0];
      
      // Try different image URLs in order of preference
      const imageUrls = [
        imageToUse.thumbnail_url,
        imageToUse.medium_url,
        imageToUse.image_url
      ].filter(Boolean); // Remove null/undefined values
      
      let imageInserted = false;
      for (const imageUrl of imageUrls) {
        if (imageUrl) {
          console.log(`Attempting to insert image for artwork: ${artwork.title} using URL: ${imageUrl}`);
          try {
            await insertImageAtIndex(documentId, accessToken, currentIndex, imageUrl);
            currentIndex += 1; // Account for the inserted image
            imageInserted = true;
            console.log(`Successfully inserted image for artwork: ${artwork.title}`);
            break; // Exit loop if successful
          } catch (error) {
            console.warn(`Failed to insert image from ${imageUrl} for artwork ${artwork.title}:`, error);
            // Continue to try next URL
          }
        }
      }
      
      if (!imageInserted) {
        console.warn(`No suitable image could be inserted for artwork: ${artwork.title}`);
      }
    }
    
    // Insert artwork text content AFTER the image
    const artworkContent = generateArtworkContent(artwork, i + 1);
    await insertTextAtIndex(documentId, accessToken, currentIndex, "\n" + artworkContent);
    currentIndex += artworkContent.length + 1;
  }

  console.log("Document content updated successfully");
}
