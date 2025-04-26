
// Use direct image path and better background handling to ensure stationery appears
export function getStationeryStyle(useStationery: boolean): string {
  if (!useStationery) return '';
  
  const stationeryImagePath = '/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png';
  
  return `
    @page {
      margin: 0;
      padding: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
      position: relative;
    }
    
    /* Use both background methods for maximum compatibility */
    body::before {
      content: "";
      background-image: url('${stationeryImagePath}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: top center;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: -1;
    }
    
    /* Also include the image directly in HTML for PDF generators that don't support CSS backgrounds */
    .stationery-background-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
    }
  `;
}
