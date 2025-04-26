
// Use direct image path and better background handling to ensure stationery appears
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
    
    /* Stationery background handled via HTML */
    .stationery-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
    }
    
    .stationery-container img {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;
}
