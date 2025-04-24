
// Use direct image path and better background handling to ensure stationery appears
export function getStationeryStyle(useStationery: boolean): string {
  const stationeryImagePath = '/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png';
  
  return useStationery ? `
    @page {
      margin: 0;
      padding: 0;
    }
    
    body {
      background-image: url('${stationeryImagePath}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: top center;
      position: relative;
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
    }
    
    /* Ensure image is included as content rather than just a CSS background */
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${stationeryImagePath}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: top center;
      z-index: -1;
      opacity: 1;
    }
  ` : '';
}
