
import { Artwork } from "./types.ts";
import { insertTextAtIndex, insertImageAtIndex } from "./document-operations.ts";
import { generateHeaderContent, generateArtworkContent } from "./content-generators.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";

/**
 * Generate a proper public URL for artwork images
 */
function generateImageUrl(imageRecord: any): string | null {
  // First, try the processed URLs (thumbnail_url, medium_url) which should be complete URLs
  const directUrls = [
    imageRecord.medium_url,
    imageRecord.thumbnail_url,
    imageRecord.image_url
  ];

  for (const url of directUrls) {
    if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
  }

  // If no direct URLs, try constructing from storage paths
  const storagePaths = [
    { path: imageRecord.medium_storage_path, bucket: 'artwork-images-processed' },
    { path: imageRecord.large_storage_path, bucket: 'artwork-images-processed' },
    { path: imageRecord.thumbnail_storage_path, bucket: 'artwork-images-processed' },
    { path: imageRecord.original_storage_path, bucket: 'artwork-images-original' }
  ];

  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (baseUrl) {
    for (const { path, bucket } of storagePaths) {
      if (path && typeof path === 'string') {
        // Ensure path doesn't start with slash
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const fullUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
        return fullUrl;
      }
    }
  }

  console.warn(`[generateImageUrl] No valid image URL found for image record:`, {
    id: imageRecord.id,
    medium_url: imageRecord.medium_url,
    thumbnail_url: imageRecord.thumbnail_url,
    image_url: imageRecord.image_url,
    medium_storage_path: imageRecord.medium_storage_path,
    baseUrl: baseUrl
  });

  return null;
}

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
      // Find primary image, or use first available
      const primaryImage = artwork.artwork_images.find(img => img.is_primary);
      const imageToUse = primaryImage || artwork.artwork_images[0];
      
      console.log(`[processDocumentContent] Image record for ${artwork.title}:`, {
        id: imageToUse.id,
        is_primary: imageToUse.is_primary,
        medium_url: imageToUse.medium_url,
        thumbnail_url: imageToUse.thumbnail_url,
        image_url: imageToUse.image_url,
        medium_storage_path: imageToUse.medium_storage_path
      });
      
      // Generate proper public URL
      const imageUrl = generateImageUrl(imageToUse);
      
      if (imageUrl) {
        console.log(`Attempting to insert image for artwork: ${artwork.title} using URL: ${imageUrl}`);
        try {
          await insertImageAtIndex(documentId, accessToken, currentIndex, imageUrl);
          currentIndex += 1; // Account for the inserted image
          console.log(`Successfully inserted image for artwork: ${artwork.title}`);
        } catch (error) {
          console.error(`Failed to insert image for artwork ${artwork.title}:`, error);
          // Continue without the image
        }
      } else {
        console.warn(`No valid image URL found for artwork: ${artwork.title}`);
      }
    } else {
      console.log(`No images available for artwork: ${artwork.title}`);
    }
    
    // Insert artwork text content AFTER the image
    const artworkContent = generateArtworkContent(artwork, i + 1);
    await insertTextAtIndex(documentId, accessToken, currentIndex, "\n" + artworkContent);
    currentIndex += artworkContent.length + 1;
  }

  console.log("Document content updated successfully");
}
