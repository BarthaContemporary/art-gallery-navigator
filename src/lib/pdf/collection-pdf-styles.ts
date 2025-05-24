
/**
 * Styles specific to collection PDF generation
 */
export const collectionPdfStyles = `
  /* Collection-specific layout styles */
  .collection-name {
    font-weight: bold;
    font-size: 14pt;
    text-align: left;
    margin-bottom: 0.5cm;
    font-family: 'Source Sans 3', sans-serif;
  }
  
  .collection-description {
    margin-top: 0;
    margin-bottom: 1cm;
    font-size: 8px;
    line-height: 1.2;
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
`;
