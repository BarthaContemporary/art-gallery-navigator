
// Use direct image path and better background handling to ensure stationery appears
export function getStationeryStyle(useStationery: boolean): string {
  if (!useStationery) return '';
  
  const stationeryImagePath = '/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png';
  
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
    
    /* Stationery background handled via HTML for better compatibility */
    .stationery-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    }
  `;
}
