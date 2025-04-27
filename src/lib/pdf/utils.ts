
/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Preloads an image by creating an image element and waiting for it to load
 */
export function preloadImage(src: string): Promise<void> {
  console.log(`Preloading image: ${src}`);
  
  return new Promise((resolve, reject) => {
    // Skip if src is empty
    if (!src) {
      console.log("Empty image source, skipping preload");
      return resolve();
    }
    
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for CORS
    
    img.onload = () => {
      console.log(`Successfully preloaded image: ${src}`);
      resolve();
    };
    
    img.onerror = (e) => {
      console.error(`Failed to load image: ${src}`, e);
      // Resolve anyway to not block PDF generation
      resolve();
    };
    
    // Set source after adding event listeners
    img.src = src;
  });
}

/**
 * Creates an image tag with proper attributes for PDF rendering
 */
export function createImageTag(src: string, alt: string, className: string): string {
  if (!src) return ''; // Don't create tag for empty sources
  
  return `<img 
    src="${src}" 
    alt="${escapeHtml(alt)}" 
    class="${className}" 
    crossorigin="anonymous" 
    style="max-width: 100%; display: block;"
  />`;
}

/**
 * Embeds image data directly into HTML to avoid CORS issues
 */
export async function embedImageAsBase64(imageUrl: string): Promise<string> {
  try {
    // Skip if URL is empty
    if (!imageUrl) return '';
    
    console.log(`Attempting to fetch and encode image: ${imageUrl}`);
    
    const response = await fetch(imageUrl, { 
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.error(`Failed to embed image ${imageUrl}:`, error);
    return imageUrl; // Fall back to original URL
  }
}

/**
 * Converts a Blob to a base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        resolve(reader.result as string);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
