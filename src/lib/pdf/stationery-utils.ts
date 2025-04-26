
// Use direct image path and better background handling to ensure stationery appears
export function getStationeryStyle(useStationery: boolean): string {
  if (!useStationery) return '';
  
  const stationeryImagePath = '/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png';
  
  return `
    @page {
      margin: 0;
      padding: 0;
      size: A4;
      background-image: url('${stationeryImagePath}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: top center;
    }
    
    body {
      margin: 0;
      padding: 0;
      position: relative;
      width: 210mm;
      height: 297mm;
      background-color: white;
      background-image: url('${stationeryImagePath}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: top center;
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
      opacity: 1;
      pointer-events: none;
    }
    
    /* Also include the image directly in HTML for PDF generators that don't support CSS backgrounds */
    .stationery-background-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      opacity: 1;
      pointer-events: none;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 1;
    }
  `;
}
