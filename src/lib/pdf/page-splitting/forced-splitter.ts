
import { reconstructPageHTML } from './html-utils';

/**
 * Splits HTML into pages by artwork using DOMParser based on 'data-artwork-page-boundary'.
 * Used when forceSplitPages is true for collections.
 */
export function splitByDataAttribute(html: string): string[] {
  console.log("Attempting to force split HTML into pages by 'data-artwork-page-boundary' attribute.");
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc || !doc.head || !doc.body) {
    console.error("Failed to parse HTML string with DOMParser in splitByDataAttribute. Returning original HTML as single page.");
    return [html];
  }

  const headHTML = doc.head.innerHTML;
  
  let bodyAttributes = "";
  for (const attr of Array.from(doc.body.attributes)) {
    bodyAttributes += ` ${attr.name}="${attr.value}"`;
  }

  const stationeryBackgroundElement = doc.body.querySelector('.stationery-background');
  const stationeryHTML = stationeryBackgroundElement ? stationeryBackgroundElement.outerHTML : '';
  
  const contentWrapperElement = doc.body.querySelector('.content-wrapper');
  if (!contentWrapperElement) {
    console.warn("Could not find '.content-wrapper' in HTML for force splitting. Returning original HTML as single page.");
    return [html];
  }
  
  const artworkElements = contentWrapperElement.querySelectorAll('div[data-artwork-page-boundary="true"]');
  console.log(`Found ${artworkElements.length} artwork elements with 'data-artwork-page-boundary="true"'.`);
  
  if (artworkElements.length === 0) {
    console.warn("No artwork elements found for splitting. The HTML might not contain the 'data-artwork-page-boundary' attribute or it's empty. Returning original HTML as single page.");
    return [html];
  }
  
  const pages: string[] = [];
  artworkElements.forEach((artworkElement, index) => {
    console.log(`Processing artwork element ${index + 1}: ${artworkElement.getAttribute('data-artwork-title') || 'Untitled Artwork'}`);
    const artworkHTML = artworkElement.outerHTML;
    
    const pageHTML = reconstructPageHTML(artworkHTML, headHTML, bodyAttributes, stationeryHTML);
    pages.push(pageHTML);
  });
  
  if (pages.length > 0) {
    console.log(`Successfully split HTML into ${pages.length} pages using force split (data attribute).`);
  } else {
    console.warn("Force splitting (data attribute) did not produce any pages, though artwork elements were found. This is unexpected. Returning original HTML.");
    return [html];
  }
  
  return pages;
}

