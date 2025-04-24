
import { Collection } from "@/hooks/use-collections";
import { escapeHtml } from "./utils";
import { 
  baseStyles, 
  stationeryStyles, 
  getStationeryStyle, 
  cmToInchFraction 
} from "./styles";
import { supabase } from "@/integrations/supabase/client";

async function getArtistName(artistId: string | null): Promise<string> {
  if (!artistId) return "Artist Name";
  
  const { data, error } = await supabase
    .from('artists')
    .select('full_name')
    .eq('id', artistId)
    .single();
    
  if (error || !data) return "Artist Name";
  return data.full_name;
}

async function getLocationName(locationId: string | null): Promise<string> {
  if (!locationId) return "Location Name";
  
  const { data, error } = await supabase
    .from('locations')
    .select('name')
    .eq('id', locationId)
    .single();
    
  if (error || !data) return "Location Name";
  return data.name;
}

export async function generateCollectionHTML(
  collection: Collection,
  templateStyle: string = 'collection',
  useStationery: boolean = true // Collections are always on stationery
): Promise<string> {
  // Get artist and location names for all artworks in the collection
  const artworkDataPromises = collection.artworks?.map(async (artwork) => {
    const artistName = await getArtistName(artwork.artist_id);
    const locationName = await getLocationName(artwork.location_id);
    
    return {
      ...artwork,
      artistName,
      locationName
    };
  }) || [];
  
  const artworksWithData = await Promise.all(artworkDataPromises);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Collection: ${escapeHtml(collection.name)}</title>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap">
        <style>
          ${baseStyles}
          ${stationeryStyles}
          ${getStationeryStyle(useStationery)}
          
          /* Additional PDF-specific fixes */
          body {
            margin: 0;
            padding: 0;
            font-size: 10px;
            line-height: 1.2;
            font-family: 'Source Sans 3', sans-serif;
          }
          
          * {
            box-sizing: border-box;
          }
          
          .collection-item-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="content-wrapper">
          <div class="collection-name">${escapeHtml(collection.name)}</div>
          
          ${collection.description ? `
            <div class="collection-description">
              ${escapeHtml(collection.description)}
            </div>
          ` : ''}
          
          <div class="collection-items">
            <h2>Artworks in this Collection</h2>
            
            ${artworksWithData.map(artwork => {
              // Format edition information
              let editionInfo = '';
              if (artwork.edition_size && artwork.edition_size > 1) {
                editionInfo = `Edition of ${artwork.edition_size}`;
                if (artwork.artist_proofs) {
                  editionInfo += ` + ${artwork.artist_proofs} AP`;
                }
              }
              
              // Format dimensions
              let dimensionsDisplay = artwork.dimensions || '';
              let frameDimensionsDisplay = '';
              
              if (artwork.is_framed && artwork.frame_height && artwork.frame_width) {
                frameDimensionsDisplay = `Frame: ${artwork.frame_height} x ${artwork.frame_width}${artwork.frame_depth ? ` x ${artwork.frame_depth}` : ''} cm`;
              }
              
              return `
                <div class="collection-item">
                  <div class="collection-item-image-container">
                    <img 
                      src="${artwork.image_url || '/placeholder.svg'}" 
                      alt="${escapeHtml(artwork.title)}" 
                      class="collection-item-image"
                    />
                  </div>
                  <div class="collection-item-details">
                    <p class="artist-name">${escapeHtml(artwork.artistName)}</p>
                    <p class="artwork-title">${escapeHtml(artwork.title)}${artwork.year ? `, ${artwork.year}` : ''}</p>
                    ${artwork.materials ? `<p class="materials">${escapeHtml(artwork.materials)}</p>` : ''}
                    ${editionInfo ? `<p class="edition-details">${editionInfo}</p>` : ''}
                    ${dimensionsDisplay ? `<p class="dimensions">${dimensionsDisplay}</p>` : ''}
                    ${frameDimensionsDisplay ? `<p class="frame-dimensions">${frameDimensionsDisplay}</p>` : ''}
                    ${artwork.location_id ? `<p>Location: ${escapeHtml(artwork.locationName)}</p>` : ''}
                    ${artwork.price ? `<p class="price">${artwork.currency} ${artwork.price.toLocaleString()}</p>` : ''}
                  </div>
                </div>
              `;
            }).join('') || '<p>No artworks in this collection</p>'}
          </div>
        </div>
      </body>
    </html>
  `;
}
