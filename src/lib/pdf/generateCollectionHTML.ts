
import { Collection } from "@/hooks/use-collections";
import { baseStyles } from "./base-styles";
import { getStationeryStyle, getStationeryBackgroundHTML } from "./stationery-utils";
import { supabase } from "@/integrations/supabase/client";
import { escapeHtml, preloadImage } from "./utils";

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
        currency
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
  
  // Format artworks for display
  const artworkItems = artworks?.map((item) => {
    const artwork = item.artworks;
    // Correctly access the artist name from the nested structure
    const artist = item.artists && item.artists.artist_id ? item.artists.artist_id.full_name : 'Unknown Artist';
    
    // Prepare image HTML with proper attributes
    const imageHtml = artwork.image_url 
      ? `<img 
          src="${artwork.image_url}" 
          alt="${escapeHtml(artwork.title)}" 
          class="collection-item-image" 
          crossorigin="anonymous" 
          style="max-width: 100%; max-height: 100%; object-fit: contain;"
        />`
      : `<div class="image-placeholder" style="width: 100%; height: 100%; background-color: #eee;"></div>`;
    
    return `
      <div class="collection-item" style="margin-bottom: 1.5cm; page-break-inside: avoid;">
        <div class="collection-item-image-container" style="text-align: center; margin-bottom: 0.5cm; height: 5cm;">
          ${imageHtml}
        </div>
        <div class="collection-item-details">
          <p class="artist-name" style="font-weight: bold; margin-bottom: 0.2cm;">${escapeHtml(artist)}</p>
          <p class="artwork-title" style="font-style: italic; margin-bottom: 0.2cm;">${escapeHtml(artwork.title)}${artwork.year ? ', ' + artwork.year : ''}</p>
          <p class="materials" style="margin-bottom: 0.2cm;">${escapeHtml(artwork.materials || '')}</p>
          <p class="dimensions" style="margin-bottom: 0.2cm;">${artwork.dimensions || (artwork.height && artwork.width ? `${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm` : '')}</p>
          ${artwork.price ? `<p class="price" style="font-weight: bold;">${artwork.currency || '£'} ${artwork.price.toLocaleString()}</p>` : ''}
        </div>
      </div>
    `;
  }).join('') || '';

  // Generate the HTML content with inline styles
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(collection.name || "Collection")}</title>
      <style>
        /* Base styles */
        ${baseStyles}
        
        /* Additional collection styles */
        .collection-name {
          position: absolute;
          top: 6cm;
          left: 4cm;
          font-weight: bold;
          font-size: 14pt;
          z-index: 10;
        }
        
        .collection-description {
          margin-bottom: 2cm;
          font-style: italic;
        }
        
        .collection-items {
          display: flex;
          flex-direction: column;
          gap: 2cm;
        }
        
        /* Ensure all images display correctly */
        img {
          max-width: 100%;
          display: block;
        }
        
        /* Stationery styles if enabled */
        ${getStationeryStyle(useStationery)}
      </style>
    </head>
    <body>
      ${useStationery ? getStationeryBackgroundHTML() : ''}
      
      <div class="collection-name">${escapeHtml(collection.name)}</div>
      
      <div class="content-wrapper">
        ${collection.description ? `<p class="collection-description">${escapeHtml(collection.description)}</p>` : ''}
        
        <div class="collection-items">
          ${artworkItems}
        </div>
      </div>
    </body>
    </html>
  `;
  
  console.log("Collection HTML generation complete");
  return html;
}
