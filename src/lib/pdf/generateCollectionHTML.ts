
import { Collection } from "@/hooks/use-collections";
import { escapeHtml } from "./utils";
import { baseStyles, templateStyles, getStationeryStyle } from "./styles";

export function generateCollectionHTML(
  collection: Collection,
  templateStyle: string = 'classic',
  useStationery: boolean = false
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Collection: ${escapeHtml(collection.name)}</title>
        <meta charset="UTF-8">
        <style>
          ${baseStyles}
          ${templateStyles[templateStyle as keyof typeof templateStyles]}
          ${getStationeryStyle(useStationery)}
        </style>
      </head>
      <body>
        <div class="content-wrapper">
          <h1>Collection: ${escapeHtml(collection.name)}</h1>
          
          ${collection.description ? `
            <div class="collection-description">
              ${escapeHtml(collection.description)}
            </div>
          ` : ''}
          
          <h2>Artworks</h2>
          
          ${collection.artworks?.map(artwork => `
            <div class="artwork">
              <h3>${escapeHtml(artwork.title)} ${artwork.year ? `(${artwork.year})` : ''}</h3>
              <div class="artwork-detail">
                <span class="detail-label">Medium:</span>
                ${escapeHtml(artwork.medium_type || 'N/A')}
              </div>
              ${artwork.materials ? `
                <div class="artwork-detail">
                  <span class="detail-label">Materials:</span>
                  ${escapeHtml(artwork.materials)}
                </div>
              ` : ''}
              ${artwork.dimensions ? `
                <div class="artwork-detail">
                  <span class="detail-label">Dimensions:</span>
                  ${escapeHtml(artwork.dimensions)}
                </div>
              ` : ''}
            </div>
          `).join('') || '<p>No artworks in this collection</p>'}
        </div>
      </body>
    </html>
  `;
}

