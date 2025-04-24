
// Create background stationery style with 100% opacity
export function getStationeryStyle(useStationery: boolean): string {
  return useStationery ? `
    body {
      background-image: url('/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: center;
      position: relative;
      z-index: -1;
      height: 100%;
      width: 100%;
    }
  ` : '';
}
