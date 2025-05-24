
import { Collection } from "@/hooks/use-collections";
import { baseStyles } from "./base-styles";
import { getStationeryStyle, getStationeryBackgroundHTML } from "./stationery-utils";
import { supabase } from "@/integrations/supabase/client";
import { preloadImage } from "./utils";
import { collectionPdfStyles } from "./collection-pdf-styles";
import { generateCollectionHeaderHTML } from "./collection-pdf-utils";
import { generateArtworkHTML } from "./collection-artwork-html";

export async function generateCollectionHTML(
  collection: Collection,
  templateStyle: string = 'classic',
  useStationery: boolean = true
): Promise<string> {
  console.log(`Generating HTML for collection: ${collection.name}, stationery: ${useStationery}`);
  
  // Fetch collection artworks
  const { data: artworks, error } = await supabase
    .from('collection_artworks')
    .select(`
      artwork_id,
      artworks (
        id,
        title,
        image_url,
        artist_id,
        materials,
        year,
        dimensions,
        height,
        width,
        depth,
        is_framed,
        frame_height,
        frame_width,
        frame_depth,
        price,
        currency,
        medium_type,
        classification,
        edition_size,
        artist_proofs
      ),
      artists:artworks(artist_id(id, full_name))
    `)
    .eq('collection_id', collection.id);

  if (error) {
    console.error("Error fetching collection artworks:", error);
    return `<html><body><h1>Error generating PDF</h1><p>${error.message}</p></body></html>`;
  }

  // Preload artwork images
  const imagePromises = artworks?.map(item => {
    if (item.artworks && item.artworks.image_url) {
      return preloadImage(item.artworks.image_url);
    }
    return Promise.resolve();
  }) || [];
  
  // Preload stationery background if used
  if (useStationery) {
    imagePromises.push(preloadImage("/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png"));
  }
  
  // Wait for all images to preload
  try {
    await Promise.all(imagePromises);
    console.log("All collection images preloaded");
  } catch (error) {
    console.error("Error preloading collection images:", error);
  }
  
  // Generate collection header HTML
  const collectionHeader = generateCollectionHeaderHTML(collection);
  
  // Generate HTML for each artwork
  const artworkItems = artworks?.map((item, index) => {
    const artwork = item.artworks;
    // Correctly access the artist name from the nested structure
    const artistName = item.artists && item.artists.artist_id ? item.artists.artist_id.full_name : 'Unknown Artist';
    
    // Generate HTML for this artwork
    return generateArtworkHTML(artwork, artistName, index === 0, collectionHeader);
  }).join('') || '';

  // Generate the HTML content with inline styles
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${collection.name || "Collection"}</title>
      <style>
        /* Ensure A4 page size */
        @page {
          size: A4;
          margin: 0; 
        }

        body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
          position: relative; /* For stationery background */
        }

        /* Base styles */
        ${baseStyles}
        
        /* Collection-specific styles */
        ${collectionPdfStyles}
        
        /* Stationery styles if enabled */
        ${getStationeryStyle(useStationery)}
        
        .content-wrapper {
          padding: 7cm 2cm 2cm 2cm; /* Note: This padding might differ from stationeryStyles */
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }
      </style>
    </head>
    <body>
      ${useStationery ? getStationeryBackgroundHTML() : ''}
      
      <div class="content-wrapper">
        ${artworkItems}
      </div>
    </body>
    </html>
  `;
  
  console.log("Collection HTML generation complete");
  return html;
}
