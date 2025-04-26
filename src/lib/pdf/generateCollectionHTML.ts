
import { Collection } from "@/hooks/use-collections";
import { baseStyles, stationeryStyles, getStationeryStyle } from "./styles";
import { supabase } from "@/integrations/supabase/client";

export async function generateCollectionHTML(
  collection: Collection,
  templateStyle: string = 'classic',
  useStationery: boolean = true
): Promise<string> {
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

  // Format artworks for display
  const artworkItems = artworks?.map((item) => {
    const artwork = item.artworks;
    // Correctly access the artist name from the nested structure
    const artist = item.artists && item.artists.artist_id ? item.artists.artist_id.full_name : 'Unknown Artist';
    
    return `
      <div class="collection-item">
        <div class="collection-item-image-container">
          <img src="${artwork.image_url || '/placeholder.svg'}" alt="${artwork.title}" class="collection-item-image" />
        </div>
        <div class="collection-item-details">
          <p class="artist-name">${artist}</p>
          <p class="artwork-title">${artwork.title}${artwork.year ? ', ' + artwork.year : ''}</p>
          <p class="materials">${artwork.materials || ''}</p>
          <p class="dimensions">${artwork.dimensions || (artwork.height && artwork.width ? `${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm` : '')}</p>
          ${artwork.price ? `<p class="price">${artwork.currency || '£'} ${artwork.price.toLocaleString()}</p>` : ''}
        </div>
      </div>
    `;
  }).join('') || '';

  // Get the appropriate styles based on whether stationery is used
  const styles = useStationery ? getStationeryStyle(true) : '';
  
  // The path to the stationery image - used for direct image inclusion
  const stationeryImagePath = '/lovable-uploads/daab986c-42d2-4558-97df-8b286b5cb911.png';

  // Generate the HTML content
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${collection.name || "Collection"}</title>
      <style>
        ${baseStyles}
        ${stationeryStyles}
        ${styles}
      </style>
    </head>
    <body>
      ${useStationery ? `<img src="${stationeryImagePath}" alt="Stationery" class="stationery-background-image" />` : ''}
      
      <div class="collection-name">${collection.name}</div>
      
      <div class="content-wrapper">
        ${collection.description ? `<p class="collection-description">${collection.description}</p>` : ''}
        
        <div class="collection-items">
          ${artworkItems}
        </div>
      </div>
    </body>
    </html>
  `;
}
