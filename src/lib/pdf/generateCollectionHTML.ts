
import { Collection } from "@/hooks/use-collections";
import { baseStyles } from "./base-styles";
import { getStationeryStyle, getStationeryBackgroundHTML } from "./stationery-utils";
import { supabase } from "@/integrations/supabase/client";
import { escapeHtml, preloadImage } from "./utils";
import { cmToInchFraction } from "./unit-conversion";

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
  
  // First, create the collection header HTML
  const collectionHeader = `
    <div class="collection-name">${escapeHtml(collection.name)}</div>
    ${collection.description ? `<p class="collection-description">${escapeHtml(collection.description)}</p>` : ''}
  `;
  
  // Format artworks for display - each in its own page with proper spacing
  const artworkItems = artworks?.map((item, index) => {
    const artwork = item.artworks;
    // Correctly access the artist name from the nested structure
    const artistName = item.artists && item.artists.artist_id ? item.artists.artist_id.full_name : 'Unknown Artist';
    
    // Prepare image HTML with proper attributes
    const imageHtml = artwork.image_url 
      ? `<img 
          src="${artwork.image_url}" 
          alt="${escapeHtml(artwork.title)}" 
          class="artwork-image" 
          crossorigin="anonymous"
        />`
      : `<div class="image-placeholder">No image available</div>`;
    
    // Format dimensions in cm and inches
    let dimensionsCm = '';
    let dimensionsInches = '';
    if (artwork.height && artwork.width) {
      dimensionsCm = `${artwork.height} x ${artwork.width}${artwork.depth ? ' x ' + artwork.depth : ''} cm`;
      dimensionsInches = `${cmToInchFraction(artwork.height)} x ${cmToInchFraction(artwork.width)}${
        artwork.depth ? ' x ' + cmToInchFraction(artwork.depth) : ''
      }"`;
    }
    
    // Edition information
    let editionInfo = '';
    if (artwork.classification === 'Unique') {
      editionInfo = 'Unique';
    } else if (artwork.edition_size) {
      editionInfo = `Edition of ${artwork.edition_size}${
        artwork.artist_proofs ? ' + ' + artwork.artist_proofs + ' AP' : ''
      }`;
    } else if (artwork.classification) {
      editionInfo = artwork.classification;
    }
    
    // Format price with proper spacing
    let priceHtml = '';
    if (artwork.price !== null && artwork.currency) {
      try {
        const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: artwork.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(artwork.price);
        // Add spacing before price
        priceHtml = `<p class="price">${escapeHtml(formattedPrice)}</p>`;
      } catch (e) {
        console.error("Error formatting price for PDF:", e);
        // Fallback display
        priceHtml = `<p class="price">${escapeHtml(String(artwork.price))} ${escapeHtml(artwork.currency)}</p>`;
      }
    }
    
    // First artwork includes collection info, others are standalone pages
    const pageClass = index === 0 ? 'first-artwork' : 'artwork-page';
    const includeCollectionInfo = index === 0 ? collectionHeader : '';
    
    return `
      <div class="${pageClass}" ${index > 0 ? 'style="page-break-before: always;"' : ''}>
        ${includeCollectionInfo}
        
        <div class="artist-name-header">${escapeHtml(artistName)}</div>
        
        <div class="artwork-image-container">
          ${imageHtml}
        </div>
        
        <div class="artwork-details">
          <p class="artist-name"><strong>${escapeHtml(artistName)}</strong></p>
          <p class="artwork-title"><strong>${escapeHtml(artwork.title || 'Untitled')}${artwork.year ? ', ' + artwork.year : ''}</strong></p>
          ${artwork.materials ? `<p class="materials">${escapeHtml(artwork.materials)}</p>` : ''}
          ${editionInfo ? `<p class="edition-details">${escapeHtml(editionInfo)}</p>` : ''}
          ${dimensionsCm ? `<p class="dimensions">${dimensionsCm}</p>` : ''}
          ${dimensionsInches ? `<p class="dimensions">${dimensionsInches}</p>` : ''}
          ${artwork.medium_type ? `<p class="medium-type">${escapeHtml(artwork.medium_type)}</p>` : ''}
          ${priceHtml}
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
        
        /* Additional collection-specific styles */
        .collection-name {
          position: absolute;
          top: 6cm;
          left: 4cm;
          font-weight: bold;
          font-size: 14pt;
          z-index: 10;
        }
        
        .collection-description {
          margin-bottom: 1cm;
          font-style: italic;
          text-align: left;
        }
        
        .artist-name-header {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 0.5cm;
          text-align: left;
        }
        
        .artwork-image-container {
          text-align: left;
          margin-bottom: 1cm;
        }
        
        .artwork-image {
          max-width: 100%;
          max-height: 400px;
          object-fit: contain;
          margin: 0 0 1cm 0;
        }
        
        .image-placeholder {
          height: 400px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          border: 1px dashed #ccc;
          margin-bottom: 1cm;
          padding-left: 1cm;
        }
        
        .artwork-details p {
          margin-bottom: 0.15cm;
          font-size: 10pt;
          text-align: left;
        }
        
        .artwork-page {
          height: 100%;
          width: 100%;
          position: relative;
        }
        
        .price {
          margin-top: 0.35cm;
          font-weight: bold;
        }
        
        .first-artwork {}
        
        /* Stationery styles if enabled */
        ${getStationeryStyle(useStationery)}
        
        .content-wrapper {
          padding: 7cm 2cm 2cm 2cm;
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
