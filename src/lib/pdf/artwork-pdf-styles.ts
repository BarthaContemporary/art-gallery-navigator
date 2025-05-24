
/**
 * Styles specific to the artwork PDF.
 */
export const artworkPdfStyles = `
  /* Ensure A4 page size */
  @page {
    size: A4;
    margin: 0; 
  }

  body {
    /* These are already set in generateArtworkHTML's main body tag style setup if needed, 
       but defining them here for clarity and consistency with PDF page setup. */
    width: 210mm; 
    height: 297mm;
    margin: 0;
    padding: 0;
    position: relative; /* For stationery background */
  }

  img {
    /* Removed max-width: 100%; to allow artwork-image to control its size within container */
    height: auto;
    display: block;
    /* Removed margin: 0 auto; to allow left alignment */
  }
  
  .artwork-image {
    max-width: 100%; /* Constrain image width within its container */
    max-height: 400px; 
    object-fit: contain;
    margin: 0 0 1cm 0; /* Align to left, provide bottom margin */
  }
  
  .artwork-image-container {
    text-align: left; /* Align content (image) to the left */
    margin-bottom: 1cm;
  }

  .artist-name-header {
    font-size: 18pt;
    font-weight: bold;
    margin-bottom: 0.5cm;
    text-align: left; 
  }

  .artwork-details p {
    margin-bottom: 0.15cm; /* Reduced spacing between caption lines */
    font-size: 10pt; 
    text-align: left; /* Ensure artwork details text is left-aligned */
  }

  /* content-wrapper styles are applied inline in generateArtworkHTML 
     if they need to be dynamic or are very specific to the template structure.
     However, if static, they can be defined here.
     For now, keeping the padding for content-wrapper in generateArtworkHTML.ts
     as it was previously set there. If it's meant to be static, it can be moved here.
     The current generateArtworkHTML.ts applies padding for content-wrapper dynamically
     based on stationery use, so it might be best to keep it there or pass padding as a prop.
     Let's assume the padding set in generateArtworkHTML.ts is intentional for now.
  */
  .content-wrapper {
    /* padding: 7cm 2cm 2cm 2cm; */ /* This was in generateArtworkHTML.ts's style tag */
    position: relative;
    z-index: 1;
    box-sizing: border-box;
  }
`;
