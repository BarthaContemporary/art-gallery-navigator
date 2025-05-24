
/**
 * Waits for all resources (images, fonts) to load within a container
 */
export async function waitForResources(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  
  const imagePromises = images.map((img) => {
    if (img.complete && img.naturalHeight !== 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`Failed to load image: ${img.src ? img.src.substring(0, 50) + '...' : 'unknown src'}`);
        resolve(); // Resolve anyway
      };
      img.crossOrigin = "Anonymous"; // Ensure CORS is set for html2canvas
      // If src is already set, it might be enough, but re-setting can help trigger load in some cases.
      // However, be cautious if this causes images to reload unnecessarily or break data URLs.
      // For now, rely on html2canvas onclone to handle images properly.
    });
  });

  if (imagePromises.length > 0) {
    await Promise.all(imagePromises);
  }
  
  // Additional wait for fonts and layout, similar to original
  await new Promise(resolve => setTimeout(resolve, 300));
}
