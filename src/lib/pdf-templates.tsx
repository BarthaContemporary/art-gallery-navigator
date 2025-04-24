import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { Collection } from "@/hooks/use-collections";

// Helper function to escape HTML to prevent XSS
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Templates for artwork PDFs
export function generateArtworkHTML(
  artwork: Artwork, 
  templateStyle: string = 'classic',
  useStationery: boolean = false
): string {
  // Base styles
  const baseStyles = `
    body { 
      font-family: Arial, sans-serif; 
      margin: 0;
      padding: 0;
      color: #333;
      line-height: 1.6;
    }
    .detail-label {
      font-weight: bold;
      color: #18465a;
      margin-right: 8px;
    }
    @media print {
      body { margin: 0; padding: 0; }
    }
  `;
  
  // Template-specific styles
  const templateStyles = {
    classic: `
      h1 { 
        color: #18465a;
        font-size: 24px;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #18465a;
      }
      .detail { 
        margin-bottom: 15px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
      }
      .section {
        margin-bottom: 30px;
      }
    `,
    modern: `
      h1 { 
        color: #18465a;
        font-size: 28px;
        font-weight: 300;
        margin-bottom: 30px;
      }
      .detail { 
        margin-bottom: 20px;
        padding-left: 15px;
        border-left: 3px solid #18465a;
      }
      .section {
        margin-bottom: 40px;
      }
    `,
    minimal: `
      h1 { 
        text-transform: uppercase;
        letter-spacing: 3px;
        font-size: 20px;
        margin-bottom: 30px;
        font-weight: normal;
      }
      .detail { 
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid #eee;
      }
      .detail-label {
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 1px;
        display: block;
        margin-bottom: 5px;
      }
      .section {
        margin-bottom: 30px;
      }
    `
  };
  
  // Stationery background
  const stationeryStyle = useStationery ? `
    body {
      background-image: url('/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      position: relative;
    }
    .content-wrapper {
      position: relative;
      z-index: 1;
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
    }
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Artwork: ${escapeHtml(artwork.title)}</title>
        <meta charset="UTF-8">
        <style>
          ${baseStyles}
          ${templateStyles[templateStyle as keyof typeof templateStyles]}
          ${stationeryStyle}
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

// Templates for collection PDFs
export function generateCollectionHTML(
  collection: Collection,
  templateStyle: string = 'classic',
  useStationery: boolean = false
): string {
  // Base styles
  const baseStyles = `
    body { 
      font-family: Arial, sans-serif; 
      margin: 0;
      padding: 0;
      color: #333;
      line-height: 1.6;
    }
    .detail-label {
      font-weight: bold;
      color: #18465a;
    }
    @media print {
      body { margin: 0; padding: 0; }
    }
  `;
  
  // Template-specific styles
  const templateStyles = {
    classic: `
      h1 { 
        color: #18465a;
        font-size: 28px;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #18465a;
      }
      h2 {
        color: #18465a;
        font-size: 22px;
        margin: 30px 0 20px;
      }
      .collection-description {
        font-size: 16px;
        margin-bottom: 30px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 6px;
      }
      .artwork { 
        margin-bottom: 25px; 
        padding: 20px;
        background: #fff;
        border: 1px solid #e1e4e8;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .artwork h3 {
        color: #18465a;
        font-size: 18px;
        margin: 0 0 15px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e1e4e8;
      }
    `,
    modern: `
      h1 { 
        color: #18465a;
        font-size: 32px;
        font-weight: 300;
        margin-bottom: 30px;
      }
      h2 {
        color: #18465a;
        font-size: 24px;
        font-weight: 300;
        margin: 40px 0 20px;
        padding-left: 15px;
        border-left: 4px solid #18465a;
      }
      .collection-description {
        font-size: 16px;
        margin-bottom: 40px;
        padding-left: 20px;
        border-left: 3px solid #18465a;
        line-height: 1.8;
      }
      .artwork { 
        margin-bottom: 30px;
        padding: 25px;
        border-left: 3px solid #18465a;
      }
      .artwork h3 {
        color: #18465a;
        font-size: 20px;
        font-weight: 400;
        margin: 0 0 20px;
      }
    `,
    minimal: `
      h1 { 
        text-transform: uppercase;
        letter-spacing: 3px;
        font-size: 24px;
        margin-bottom: 30px;
        font-weight: normal;
      }
      h2 {
        text-transform: uppercase;
        letter-spacing: 2px;
        font-size: 18px;
        margin: 40px 0 20px;
        font-weight: normal;
      }
      .collection-description {
        font-size: 16px;
        margin-bottom: 40px;
        line-height: 1.8;
      }
      .artwork { 
        margin-bottom: 30px;
        padding-bottom: 30px;
        border-bottom: 1px solid #eee;
      }
      .artwork h3 {
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 16px;
        margin: 0 0 15px;
        font-weight: normal;
      }
      .artwork-detail {
        margin: 8px 0;
      }
      .detail-label {
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 1px;
        display: block;
        margin-bottom: 5px;
      }
    `
  };
  
  // Stationery background
  const stationeryStyle = useStationery ? `
    body {
      background-image: url('/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      position: relative;
    }
    .content-wrapper {
      position: relative;
      z-index: 1;
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
    }
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Collection: ${escapeHtml(collection.name)}</title>
        <meta charset="UTF-8">
        <style>
          ${baseStyles}
          ${templateStyles[templateStyle as keyof typeof templateStyles]}
          ${stationeryStyle}
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

// Preview components for different PDF types
export function ArtworkPDFPreview({ artwork }: { artwork: Artwork }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Basic Information</h2>
        <div className="bg-muted/50 p-3 rounded-md mt-2">
          <p><span className="font-medium">Medium:</span> {artwork.medium_type || 'N/A'}</p>
          {artwork.materials && <p><span className="font-medium">Materials:</span> {artwork.materials}</p>}
          {artwork.dimensions && <p><span className="font-medium">Dimensions:</span> {artwork.dimensions}</p>}
          {artwork.status && <p><span className="font-medium">Status:</span> {artwork.status}</p>}
        </div>
      </div>
      
      {(artwork.story || artwork.provenance) && (
        <div>
          <h2 className="text-lg font-medium">Details</h2>
          <div className="bg-muted/50 p-3 rounded-md mt-2">
            {artwork.story && (
              <div className="mb-3">
                <p className="font-medium">Story:</p>
                <p>{artwork.story}</p>
              </div>
            )}
            {artwork.provenance && (
              <div>
                <p className="font-medium">Provenance:</p>
                <p>{artwork.provenance}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CollectionPDFPreview({ collection }: { collection: Collection }) {
  return (
    <div className="space-y-6">
      {collection.description && (
        <div className="bg-muted/50 p-3 rounded-md">
          <p>{collection.description}</p>
        </div>
      )}
      
      <h2 className="text-lg font-medium">Artworks</h2>
      
      {collection.artworks && collection.artworks.length > 0 ? (
        <div className="space-y-4">
          {collection.artworks.map((artwork) => (
            <div key={artwork.id} className="border p-3 rounded-md">
              <h3 className="font-medium">{artwork.title} {artwork.year && `(${artwork.year})`}</h3>
              <p><span className="text-sm text-muted-foreground">Medium:</span> {artwork.medium_type || 'N/A'}</p>
              {artwork.materials && <p className="text-sm">{artwork.materials}</p>}
              {artwork.dimensions && <p className="text-sm">{artwork.dimensions}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p>No artworks in this collection</p>
      )}
    </div>
  );
}
