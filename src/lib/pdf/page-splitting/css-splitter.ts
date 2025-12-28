
import { extractCommonHTMLParts, reconstructPageHTML } from './html-utils';
import { hasPageBreakBefore, hasPageBreakAfter } from './css-break-detectors';
import DOMPurify from "dompurify";

/**
 * Splits HTML into separate pages based on CSS page-break markers.
 */
export function splitByCSSPageBreaks(html: string): string[] {
  console.log("Attempting to split HTML into multiple pages based on CSS page-break properties.");
  
  const { headContent, bodyAttributes, stationeryHTML } = extractCommonHTMLParts(html);

  // Sanitize HTML before DOM parsing
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['class', 'style', 'src', 'alt', 'width', 'height', 'data-page-break'],
    ALLOW_DATA_ATTR: true,
  });

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHtml;
  
  const pagesContents: string[] = [];
  let currentPageAccumulator = document.createElement('div'); // Accumulates elements for the current page
  
  const bodyElement = tempDiv.querySelector('body');
  if (!bodyElement) {
    console.warn("Could not find body element in HTML for CSS-based splitting. Returning original HTML.");
    return [html];
  }
  
  const contentWrapper = bodyElement.querySelector('.content-wrapper') || bodyElement;
  
  Array.from(contentWrapper.children).forEach((element, index) => {
    const htmlElement = element as HTMLElement;

    // Use the new utility function
    if (hasPageBreakBefore(htmlElement) && index > 0 && currentPageAccumulator.children.length > 0) {
      pagesContents.push(currentPageAccumulator.innerHTML);
      currentPageAccumulator = document.createElement('div');
    }
    
    currentPageAccumulator.appendChild(htmlElement.cloneNode(true));
    
    // Use the new utility function
    if (hasPageBreakAfter(htmlElement) && currentPageAccumulator.children.length > 0) {
      pagesContents.push(currentPageAccumulator.innerHTML);
      currentPageAccumulator = document.createElement('div');
    }
  });
  
  if (currentPageAccumulator.children.length > 0) {
    pagesContents.push(currentPageAccumulator.innerHTML);
  }
  
  if (pagesContents.length === 0 && html.length > 0) {
    console.warn("CSS-based splitting resulted in 0 pages, but HTML was provided. Returning original HTML as a single page.");
    return [html];
  } else if (pagesContents.length === 0) {
     console.warn("CSS-based splitting resulted in 0 pages and no HTML. Returning empty array.");
     return [];
  }
  
  console.log(`Successfully split HTML into ${pagesContents.length} pages using CSS properties.`);
  
  return pagesContents.map(pageContent => 
    reconstructPageHTML(pageContent, headContent, bodyAttributes, stationeryHTML)
  );
}

