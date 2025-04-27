
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
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Creates an image tag with proper attributes for PDF rendering
 */
export function createImageTag(src: string, alt: string, className: string): string {
  return `<img src="${src}" alt="${escapeHtml(alt)}" class="${className}" crossorigin="anonymous" />`;
}
