
/**
 * Returns CSS styles for stationery backgrounds
 */
export function getStationeryStyle(useStationery: boolean): string {
  if (!useStationery) return '';
  
  return `
    body {
      position: relative;
      background-color: white;
      margin: 0;
      padding: 0;
    }
    
    .stationery-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
    
    .stationery-background img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 2;
      padding: 3cm 2.5cm;
    }
    
    /* Ensure all content appears above stationery */
    h1, h2, h3, p, div {
      position: relative;
      z-index: 3;
    }
  `;
}
