
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
  
  // The path to the stationery image - used for base64 embedding to ensure it appears in PDF
  const stationeryImagePath = useStationery ? '/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png' : '';
  
  // Format artwork information
  const artistName = escapeHtml(artwork.artist_name || 'Artist Name');
  const artworkTitle = escapeHtml(artwork.title || '');
  const artworkYear = artwork.year ? `, ${escapeHtml(artwork.year.toString())}` : '';
  const materials = artwork.materials ? `<p>${escapeHtml(artwork.materials)}</p>` : '';
  
  // Generate edition information
  let editionInfo = '';
  if (artwork.edition_size && artwork.edition_size > 1) {
    editionInfo = `<p>Edition of ${artwork.edition_size}${artwork.artist_proofs 
      ? ' + ' + artwork.artist_proofs + ' AP'
      : ''}</p>`;
  } else {
    editionInfo = '<p>Unique</p>';
  }
  
  // Generate dimensions information
  const dimensionsCm = artwork.height && artwork.width 
    ? `<p>${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm</p>` 
    : '';
    
  const dimensionsInches = artwork.height && artwork.width 
    ? `<p>${cmToInchFraction(artwork.height)} x ${cmToInchFraction(artwork.width)}${artwork.depth 
        ? ' x ' + cmToInchFraction(artwork.depth)
        : ''}"</p>` 
    : '';
  
  // Generate frame dimensions information if applicable
  const frameDimensionsCm = artwork.is_framed && artwork.frame_height && artwork.frame_width 
    ? `<p>Frame: ${artwork.frame_height} x ${artwork.frame_width}${artwork.frame_depth 
        ? ' x ' + artwork.frame_depth 
        : ''} cm</p>` 
    : '';
    
  const frameDimensionsInches = artwork.is_framed && artwork.frame_height && artwork.frame_width 
    ? `<p>Frame: ${cmToInchFraction(artwork.frame_height)} x ${cmToInchFraction(artwork.frame_width)}${artwork.frame_depth 
        ? ' x ' + cmToInchFraction(artwork.frame_depth)
        : ''}"</p>` 
    : '';
  
  // Price information based on template style
  const priceInfo = (templateStyle === 'basicWithPrice' || templateStyle === 'complete') && artwork.price 
    ? `<p class="price">${artwork.currency || '£'} ${artwork.price.toLocaleString()}</p>`
    : '';
  
  // Additional information based on template style
  const storySection = templateStyle === 'complete' && artwork.story 
    ? `
    <h2>Story</h2>
    <p>${escapeHtml(artwork.story)}</p>
    `
    : '';
  
  const provenanceSection = templateStyle === 'complete' && artwork.provenance 
    ? `
    <h2>Provenance</h2>
    <p>${escapeHtml(artwork.provenance)}</p>
    `
    : '';
  
  const exhibitionSection = templateStyle === 'complete' && artwork.exhibition_history 
    ? `
    <h2>Exhibition History</h2>
    <p>${escapeHtml(artwork.exhibition_history)}</p>
    `
    : '';

  // Generate HTML content with embedded styles and properly handled image paths
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(artwork.title || "Artwork")}</title>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        ${baseStyles}
        ${templateStyles}
        
        body {
          position: relative;
          margin: 0;
          padding: 0;
          width: 210mm;
          height: 297mm;
          background-color: white;
          font-family: 'Source Sans 3', sans-serif;
        }
        
        /* Background stationery styles */
        ${useStationery ? `
        .stationery-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          overflow: hidden;
        }
        
        .stationery-background img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }` : ''}
        
        .content-wrapper {
          position: relative;
          z-index: 1;
          padding: 4cm 3cm 3cm;
          min-height: 297mm;
          box-sizing: border-box;
          font-family: 'Source Sans 3', sans-serif;
        }
        
        .artwork-image-container {
          text-align: center;
          margin-bottom: 2cm;
        }
        
        .artwork-image {
          max-width: 100%;
          max-height: 15cm;
          display: inline-block;
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
          margin-top: 1.5cm;
          margin-bottom: 0.5cm;
          font-size: 14pt;
          font-weight: 600;
        }
        
        .price {
          font-weight: bold;
          margin-top: 1cm;
        }
      </style>
    </head>
    <body>
      ${useStationery ? `
      <div class="stationery-background">
        <img src="${stationeryImagePath}" alt="Stationery Background" />
      </div>
      ` : ''}
      
      <div class="content-wrapper">
        ${artwork.image_url ? `
        <div class="artwork-image-container">
          <img src="${artwork.image_url}" alt="${escapeHtml(artwork.title || 'Artwork')}" class="artwork-image" />
        </div>
        ` : ''}
        
        <p class="artist-name">${artistName}</p>
        <p class="artwork-title">${artworkTitle}${artworkYear}</p>
        
        ${materials}
        ${editionInfo}
        
        ${artwork.dimensions ? `<p>${escapeHtml(artwork.dimensions)}</p>` : ''}
        ${dimensionsCm}
        ${dimensionsInches}
        ${frameDimensionsCm}
        ${frameDimensionsInches}
        
        ${priceInfo}
        
        ${storySection}
        ${provenanceSection}
        ${exhibitionSection}
      </div>
    </body>
    </html>
  `;
}
