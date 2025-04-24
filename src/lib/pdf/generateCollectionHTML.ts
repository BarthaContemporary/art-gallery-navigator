
import { Collection } from "@/hooks/use-collections";
import { escapeHtml } from "./utils";
import { 
  baseStyles, 
  stationeryStyles, 
  getStationeryStyle, 
  cmToInchFraction 
} from "./styles";

export function generateCollectionHTML(
  collection: Collection,
  templateStyle: string = 'collection',
  useStationery: boolean = true // Collections are always on stationery
): string {
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
          ${getStationeryStyle(true)}
          
          /* Additional collection styles */
          .collection-title {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 0.1cm;
          }
          
          .collection-header {
            margin-bottom: 0.1cm;
          }
          
          h2 {
            font-size: 9px;
            margin-top: 0.1cm;
            margin-bottom: 0.1cm;
          }

          .collection-item-details p {
            margin-top: 0;
            margin-bottom: 0.05cm;
            line-height: 1.2;
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
            
            ${collection.artworks?.map(artwork => {
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
                  <img 
                    src="${artwork.image_url || '/placeholder.svg'}" 
                    alt="${escapeHtml(artwork.title)}" 
                    class="collection-item-image"
                  />
                  <div class="collection-item-details">
                    <p class="artist-name">Artist Name</p>
                    <p class="artwork-title">${escapeHtml(artwork.title)}${artwork.year ? `, ${artwork.year}` : ''}</p>
                    ${artwork.materials ? `<p class="materials">${escapeHtml(artwork.materials)}</p>` : ''}
                    ${editionInfo ? `<p class="edition-details">${editionInfo}</p>` : ''}
                    ${dimensionsDisplay ? `<p class="dimensions">${dimensionsDisplay}</p>` : ''}
                    ${frameDimensionsDisplay ? `<p class="frame-dimensions">${frameDimensionsDisplay}</p>` : ''}
                    ${artwork.location_id ? `<p>Location: Location Name</p>` : ''}
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
