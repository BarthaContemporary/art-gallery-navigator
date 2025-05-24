
/**
 * Utilities for extracting HTML parts and reconstructing page HTML.
 */

/**
 * Extracts common parts from a full HTML string.
 * @param html The full HTML string.
 * @returns An object containing headContent, bodyAttributes, originalBodyContent, and stationeryHTML.
 */
export function extractCommonHTMLParts(html: string): { 
  headContent: string; 
  bodyAttributes: string; 
  originalBodyContent: string; 
  stationeryHTML: string; 
} {
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyAttributes = bodyMatch && bodyMatch[1] ? bodyMatch[1] : '';
  const originalBodyContent = bodyMatch && bodyMatch[2] ? bodyMatch[2] : '';

  let stationeryHTML = '';
  if (originalBodyContent) {
    // Use a temporary div to parse body content and find the stationery element
    // This avoids full DOMParser for this specific task if not already using it.
    const tempOriginalBodyDiv = document.createElement('div');
    tempOriginalBodyDiv.innerHTML = originalBodyContent;
    const stationeryBackgroundElement = tempOriginalBodyDiv.querySelector('.stationery-background');
    if (stationeryBackgroundElement) {
      stationeryHTML = stationeryBackgroundElement.outerHTML;
    }
  }
  
  return { headContent, bodyAttributes, originalBodyContent, stationeryHTML };
}

/**
 * Reconstructs a full HTML page.
 * @param pageSpecificContent The main content for this page.
 * @param headContent The content for the <head> tag.
 * @param bodyAttributes Attributes for the <body> tag.
 * @param stationeryHTML HTML for the stationery background.
 * @param contentWrapperClass The class for the main content wrapper div.
 * @returns A string representing the full HTML document for the page.
 */
export function reconstructPageHTML(
  pageSpecificContent: string,
  headContent: string,
  bodyAttributes: string,
  stationeryHTML: string,
  contentWrapperClass: string = 'content-wrapper'
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      ${headContent}
    </head>
    <body${bodyAttributes}>
      ${stationeryHTML}
      <div class="${contentWrapperClass}">
        ${pageSpecificContent}
      </div>
    </body>
    </html>
  `;
}

