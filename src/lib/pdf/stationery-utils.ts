import { preloadImage } from "./utils";

// Stationery image path - cached as a constant for consistency
const STATIONERY_IMAGE_PATH = "/lovable-uploads/4750cafe-beee-4766-b1f6-7d1a41bc1ac0.png";

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
      padding: 8cm 2.5cm 3cm 2.5cm;
    }
    
    /* Ensure all content appears above stationery */
    h1, h2, h3, p, div {
      position: relative;
      z-index: 3;
      font-family: 'Source Sans 3', sans-serif;
    }
  `;
}

/**
 * Preloads the stationery image
 */
export async function preloadStationeryImage(): Promise<void> {
  console.log("Preloading stationery image");
  return preloadImage(STATIONERY_IMAGE_PATH);
}

/**
 * Gets the HTML markup for the stationery background
 */
export function getStationeryBackgroundHTML(): string {
  return `
    <div class="stationery-background">
      <img 
        src="${STATIONERY_IMAGE_PATH}" 
        alt="Company Stationery" 
        class="stationery-background-image"
        crossorigin="anonymous"
        style="width: 100%; height: 100%; object-fit: cover;"
      />
    </div>
  `;
}
