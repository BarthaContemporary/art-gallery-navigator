
import { extractCommonHTMLParts, reconstructPageHTML } from './html-utils';

/**
 * Splits HTML into separate pages based on CSS page-break markers.
 */
export function splitByCSSPageBreaks(html: string): string[] {
  console.log("Attempting to split HTML into multiple pages based on CSS page-break properties.");
  
  const { headContent, bodyAttributes, stationeryHTML } = extractCommonHTMLParts(html);

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
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

    const hasPageBreakBefore = 
      htmlElement.classList.contains('page-break-before') || 
      htmlElement.style.pageBreakBefore === 'always' ||
      htmlElement.style.breakBefore === 'page' ||
      (htmlElement.getAttribute('style') || '').includes('page-break-before:') || // More specific check
      (htmlElement.getAttribute('style') || '').includes('break-before: page');  // More specific check
    
    if (hasPageBreakBefore && index > 0 && currentPageAccumulator.children.length > 0) {
      pagesContents.push(currentPageAccumulator.innerHTML);
      currentPageAccumulator = document.createElement('div');
    }
    
    currentPageAccumulator.appendChild(htmlElement.cloneNode(true));
    
    const hasPageBreakAfter = 
      htmlElement.classList.contains('page-break-after') || 
      htmlElement.style.pageBreakAfter === 'always' ||
      htmlElement.style.breakAfter === 'page' ||
      (htmlElement.getAttribute('style') || '').includes('page-break-after:') || // More specific check
      (htmlElement.getAttribute('style') || '').includes('break-after: page'); // More specific check
    
    if (hasPageBreakAfter && currentPageAccumulator.children.length > 0) {
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

