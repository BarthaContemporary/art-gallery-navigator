
import { Artwork } from "@/hooks/use-artworks";
import { escapeHtml } from "./utils";
import { baseStyles, templateStyles, getStationeryStyle } from "./styles";

export function generateArtworkHTML(
  artwork: Artwork, 
  templateStyle: string = 'classic',
  useStationery: boolean = false
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Artwork: ${escapeHtml(artwork.title)}</title>
        <meta charset="UTF-8">
        <style>
          ${baseStyles}
          ${templateStyles[templateStyle as keyof typeof templateStyles]}
          ${getStationeryStyle(useStationery)}
        </style>
      </head>
      <body>
        <div class="content-wrapper">
          <h1>${escapeHtml(artwork.title)} ${artwork.year ? `(${artwork.year})` : ''}</h1>
          
          <div class="section">
            <div class="detail">
              <span class="detail-label">Medium:</span>
              ${escapeHtml(artwork.medium_type || 'N/A')}
            </div>
            
            ${artwork.materials ? `
              <div class="detail">
                <span class="detail-label">Materials:</span>
                ${escapeHtml(artwork.materials)}
              </div>
            ` : ''}
            
            ${artwork.dimensions ? `
              <div class="detail">
                <span class="detail-label">Dimensions:</span>
                ${escapeHtml(artwork.dimensions)}
              </div>
            ` : ''}
            
            ${artwork.status ? `
              <div class="detail">
                <span class="detail-label">Status:</span>
                ${escapeHtml(artwork.status)}
              </div>
            ` : ''}
          </div>

          ${artwork.story || artwork.provenance ? `
            <div class="section">
              ${artwork.story ? `
                <div class="detail">
                  <span class="detail-label">Story:</span>
                  ${escapeHtml(artwork.story)}
                </div>
              ` : ''}
              
              ${artwork.provenance ? `
                <div class="detail">
                  <span class="detail-label">Provenance:</span>
                  ${escapeHtml(artwork.provenance)}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;
}

