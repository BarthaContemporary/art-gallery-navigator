
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

  // Process each artwork with images
  for (let i = 0; i < artworks.length; i++) {
    const artwork = artworks[i];
    console.log(`Processing artwork ${i + 1}: ${artwork.title}`);
    
    // Insert artwork text content
    const artworkContent = generateArtworkContent(artwork, i + 1);
    await insertTextAtIndex(documentId, accessToken, currentIndex, "\n\n" + artworkContent);
    currentIndex += artworkContent.length + 2;
    
    // Insert image if available
    if (artwork.artwork_images && artwork.artwork_images.length > 0) {
      const primaryImage = artwork.artwork_images.find(img => img.is_primary);
      const imageToUse = primaryImage || artwork.artwork_images[0];
      const imageUrl = imageToUse.medium_url || imageToUse.image_url;
      
      if (imageUrl) {
        console.log(`Inserting image for artwork: ${artwork.title}`);
        try {
          await insertImageAtIndex(documentId, accessToken, currentIndex, imageUrl);
          currentIndex += 1; // Account for the inserted image
        } catch (error) {
          console.warn(`Failed to insert image for artwork ${artwork.title}:`, error);
          // Continue with next artwork even if image insertion fails
        }
      }
    }
  }

  console.log("Document content updated successfully");
}
