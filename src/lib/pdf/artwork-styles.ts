
export const plainPaperStyles = `
  @page {
    size: A4; /* Ensures A4 page size */
    margin: 0; /* Adjusted to 0, can be overridden by body or content-wrapper if needed */
    padding: 0;
  }

  body {
    width: 210mm; /* A4 width */
    height: 297mm; /* A4 height */
    margin: 0;
    padding: 0;
    background-color: white;
    position: relative;
  }

  .content-wrapper {
    /* Default padding for plain paper, generateArtworkHTML now controls specific padding for the PDF with stationery */
    /* This padding would apply if plainPaperStyles were used directly without overrides. */
    /* The 13cm top padding is now in generateArtworkHTML's inline styles for content-wrapper */
    padding: 3cm 3cm 3.5cm 3cm; 
    font-family: 'Source Sans 3', sans-serif;
    position: relative;
    z-index: 1;
    box-sizing: border-box;
  }
  
  .artwork-image {
    max-height: 6cm; /* This might need adjustment based on the large top padding */
    width: auto;
    display: block;
    margin-bottom: 1.5cm;
  }
  
  .artist-name {
    font-weight: 700;
    margin-bottom: 0.5cm;
  }
  
  .artwork-title {
    font-style: italic;
    margin-bottom: 0.5cm;
  }
  
  .materials {
    margin-bottom: 0.5cm;
  }
  
  .edition-details {
    margin-bottom: 0.5cm;
  }
  
  .dimensions {
    margin-bottom: 0.3cm;
  }
  
  .frame-dimensions {
    margin-bottom: 0.5cm;
  }
  
  .price {
    font-weight: 600;
    margin-top: 1cm;
  }
`;
