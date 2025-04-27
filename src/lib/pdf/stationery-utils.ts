
// Improved stationery styles with better visibility for background images
export function getStationeryStyle(useStationery: boolean): string {
  if (!useStationery) return '';
  
  return `
    @page {
      margin: 0;
      padding: 0;
      size: A4;
    }
    
    body {
      margin: 0;
      padding: 0;
      position: relative;
      width: 210mm;
      height: 297mm;
      background-color: white;
    }
    
    /* Stationery background styling */
    .stationery-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
    }
    
    .stationery-background img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    
    /* Ensure content appears on top of stationery */
    .content-wrapper {
      position: relative;
      z-index: 1;
    }
  `;
}
