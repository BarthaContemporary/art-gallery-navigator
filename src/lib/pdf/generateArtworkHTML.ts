
import { Artwork } from "@/hooks/use-artworks";
import { baseStyles, plainPaperStyles, getStationeryStyle } from "./styles";
import { cmToInchFraction } from "./unit-conversion";
import { escapeHtml } from "./utils";

export function generateArtworkHTML(
  artwork: Artwork,
  templateStyle: string = "basic",
  useStationery: boolean = false
): string {
  // Generate CSS for the template
  const stationeryStyle = getStationeryStyle(useStationery);
  const templateStyles = useStationery ? stationeryStyle : plainPaperStyles;
  
  // The path to the stationery image - used for direct image inclusion
  const stationeryImagePath = '/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png';
  
  // Generate HTML content based on artwork data
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(artwork.title || "Artwork")}</title>
      <style>
        ${baseStyles}
        ${templateStyles}
        
        /* Fixed positioning for content to ensure it appears correctly */
        body {
          position: relative;
          margin: 0;
          padding: 0;
          width: 210mm;
          height: 297mm;
          background-color: white;
        }
        
        .stationery-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
        }
        
        .content-wrapper {
          position: relative;
          z-index: 10;
          padding-top: 7cm; /* Increased top padding to move content down */
          padding-left: 3cm;
          padding-right: 3cm;
          padding-bottom: 3cm;
          min-height: 297mm;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
        }
        
        .artwork-image {
          max-width: 100%;
          max-height: 15cm;
          display: block;
          margin-bottom: 2cm;
          border: 1px solid #eee;
        }
        
        .artist-name {
          font-weight: bold;
          font-size: 14pt;
          margin-bottom: 0.5cm;
        }
        
        .artwork-title {
          font-style: italic;
          font-size: 12pt;
          margin-bottom: 1cm;
        }
        
        p {
          margin-bottom: 0.5cm;
          line-height: 1.5;
        }
        
        h2 {
          margin-top: 2cm;
          margin-bottom: 0.5cm;
          font-size: 14pt;
        }
      </style>
    </head>
    <body>
      ${useStationery ? `
      <div class="stationery-container">
        <img src="${stationeryImagePath}" alt="Stationery" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      ` : ''}
      
      <div class="content-wrapper">
        ${artwork.image_url ? `
          <div style="text-align: center; margin-bottom: 2cm;">
            <img src="${artwork.image_url}" alt="${escapeHtml(artwork.title || 'Artwork')}" class="artwork-image" />
          </div>
        ` : ''}
        
        <p class="artist-name">${escapeHtml(artwork.artist_name || 'Artist Name')}</p>
        <p class="artwork-title">${escapeHtml(artwork.title)}${artwork.year ? ', ' + escapeHtml(artwork.year.toString()) : ''}</p>
        
        ${artwork.materials ? `<p class="materials">${escapeHtml(artwork.materials)}</p>` : ''}
        
        ${artwork.edition_size && artwork.edition_size > 1 
          ? `<p class="edition-details">Edition of ${artwork.edition_size}${artwork.artist_proofs 
              ? ' + ' + artwork.artist_proofs + ' AP'
              : ''}</p>`
          : '<p class="edition-details">Unique</p>'}
        
        ${artwork.dimensions 
          ? `<p class="dimensions">${escapeHtml(artwork.dimensions)}</p>`
          : ''}
        
        ${artwork.height && artwork.width 
          ? `<p class="dimensions">${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm</p>` 
          : ''}
        
        ${artwork.height && artwork.width 
          ? `<p class="dimensions">${cmToInchFraction(artwork.height)} x ${cmToInchFraction(artwork.width)}${artwork.depth 
              ? ' x ' + cmToInchFraction(artwork.depth)
              : ''}"</p>` 
          : ''}
        
        ${artwork.is_framed && artwork.frame_height && artwork.frame_width 
          ? `<p class="frame-dimensions">Frame: ${artwork.frame_height} x ${artwork.frame_width}${artwork.frame_depth 
              ? ' x ' + artwork.frame_depth 
              : ''} cm</p>` 
          : ''}
        
        ${artwork.is_framed && artwork.frame_height && artwork.frame_width 
          ? `<p class="frame-dimensions">Frame: ${cmToInchFraction(artwork.frame_height)} x ${cmToInchFraction(artwork.frame_width)}${artwork.frame_depth 
              ? ' x ' + cmToInchFraction(artwork.frame_depth)
              : ''}"</p>` 
          : ''}
        
        ${(templateStyle === 'basicWithPrice' || templateStyle === 'complete') && artwork.price 
          ? `<p class="price">${artwork.currency || '£'} ${artwork.price.toString()}</p>`
          : ''}
        
        ${templateStyle === 'complete' && artwork.story 
          ? `
          <h2>Story</h2>
          <p class="artwork-story">${escapeHtml(artwork.story)}</p>
          `
          : ''}
        
        ${templateStyle === 'complete' && artwork.provenance 
          ? `
          <h2>Provenance</h2>
          <p class="artwork-provenance">${escapeHtml(artwork.provenance)}</p>
          `
          : ''}
        
        ${templateStyle === 'complete' && artwork.exhibition_history 
          ? `
          <h2>Exhibition History</h2>
          <p class="artwork-exhibition-history">${escapeHtml(artwork.exhibition_history)}</p>
          `
          : ''}
      </div>
    </body>
    </html>
  `;
}
