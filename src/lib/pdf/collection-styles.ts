export const stationeryStyles = `
  .content-wrapper {
    padding-top: 7cm;
    padding-left: 4cm;
    padding-right: 3cm;
    padding-bottom: 3.5cm;
    position: relative;
    font-family: 'Source Sans 3', sans-serif;
    font-size: 8px;
    box-sizing: border-box;
    z-index: 1;
  }
  
  .artwork-image {
    max-height: 6cm;
    width: auto;
    display: block;
    margin-bottom: 1.5cm;
    object-fit: contain;
  }
  
  .artist-name {
    font-weight: 700;
    margin-bottom: 0.05cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .artist-name-header {
    position: absolute;
    top: 8cm;
    left: 4cm;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 8px;
  }
  
  .artwork-title {
    font-style: italic;
    margin-bottom: 0.05cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .materials {
    margin-bottom: 0.05cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .edition-details {
    margin-bottom: 0.05cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .dimensions {
    margin-bottom: 0.05cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .frame-dimensions {
    margin-bottom: 0.05cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .price {
    font-weight: 600;
    margin-top: 0.1cm;
    line-height: 1.2;
    font-size: 8px;
  }
  
  .collection-name {
    text-align: left;
    font-weight: bold;
    font-size: 14pt;
    font-family: 'Source Sans 3', sans-serif;
    margin-bottom: 0.5cm;
  }
  
  .collection-description {
    margin-top: 0;
    margin-bottom: 0.1cm;
    font-size: 8px;
    line-height: 1.2;
    font-style: italic;
    text-align: left;
  }
  
  .collection-items {
    margin-top: 0.5cm;
    font-size: 8px;
  }
  
  .collection-item {
    display: flex;
    margin-bottom: 0.1cm;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.1cm;
    font-size: 8px;
  }
  
  .collection-item-image-container {
    width: 1.5cm;
    height: 1.5cm;
    flex-shrink: 0;
    margin-right: 0.3cm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .collection-item-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .collection-item-details {
    flex: 1;
    font-size: 8px;
    line-height: 1.2;
  }
  
  .collection-item-details p {
    margin-top: 0;
    margin-bottom: 0.05cm;
    font-size: 8px;
  }

  h2 {
    font-size: 9px;
    margin-bottom: 0.1cm;
    font-weight: 600;
    margin-top: 0.5cm;
  }
  
  /* Ensure stationery image is visible */
  .stationery-background-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }
`;
