/**
 * Splits HTML into separate pages based on page-break markers
 */
export function splitHTMLIntoPages(html: string, forceSplitPages: boolean = false): string[] {
  // Force splitting for collection PDFs when requested
  if (forceSplitPages) {
    console.log("Force splitting HTML into multiple pages using 'splitForcePages' method.");
    return splitForcePages(html);
  }

  // Check if we should look for page breaks
  if (!html.includes('page-break-before') && !html.includes('page-break-after') && 
      !html.includes('break-before') && !html.includes('break-after')) {
    console.log("No page breaks found in HTML, using as single page");
    return [html];
  }
  
  console.log("Attempting to split HTML into multiple pages based on CSS page-break properties.");
  
  // Create a temporary container to analyze the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const pages: string[] = [];
  let currentPageContent = '';
  let currentPage = document.createElement('div');
  
  // Process all elements in the body
  const bodyContent = tempDiv.querySelector('body');
  if (!bodyContent) {
    console.warn("Could not find body element in HTML for CSS-based splitting. Returning original HTML.");
    return [html];
  }
  
  // Find content wrapper (specific to our templates)
  const contentWrapper = bodyContent.querySelector('.content-wrapper') || bodyContent;
  
  // Process all child elements of the content wrapper
  Array.from(contentWrapper.children).forEach((element, index) => {
    const htmlElement = element as HTMLElement; // Cast to HTMLElement

    // Check for page break styles
    const hasPageBreakBefore = 
      htmlElement.classList.contains('page-break-before') || 
      htmlElement.style.pageBreakBefore === 'always' ||
      htmlElement.style.breakBefore === 'page' ||
      (htmlElement.getAttribute('style') || '').includes('page-break-before') ||
      (htmlElement.getAttribute('style') || '').includes('break-before');
    
    // For the first element, we don't need a page break
    if (hasPageBreakBefore && index > 0) {
      // Save the current page and start a new one
      if (currentPageContent) {
        pages.push(currentPageContent);
        currentPageContent = '';
        currentPage = document.createElement('div');
      }
    }
    
    // Add this element to the current page
    currentPage.appendChild(htmlElement.cloneNode(true));
    currentPageContent = currentPage.innerHTML;
    
    // Check for page break after
    const hasPageBreakAfter = 
      htmlElement.classList.contains('page-break-after') || 
      htmlElement.style.pageBreakAfter === 'always' ||
      htmlElement.style.breakAfter === 'page' ||
      (htmlElement.getAttribute('style') || '').includes('page-break-after') ||
      (htmlElement.getAttribute('style') || '').includes('break-after');
    
    if (hasPageBreakAfter) {
      // Save the current page and start a new one
      pages.push(currentPageContent);
      currentPageContent = '';
      currentPage = document.createElement('div');
    }
  });
  
  // Add the last page if there's content
  if (currentPageContent) {
    pages.push(currentPageContent);
  }
  
  // If we couldn't split the content, use the original HTML
  if (pages.length === 0 && html.length > 0) {
    console.warn("CSS-based splitting resulted in 0 pages, but HTML was provided. Returning original HTML as a single page.");
    return [html];
  } else if (pages.length === 0) {
     console.warn("CSS-based splitting resulted in 0 pages and no HTML. Returning empty array.");
     return [];
  }
  
  console.log(`Successfully split HTML into ${pages.length} pages using CSS properties.`);
  
  // Wrap each page content in proper HTML structure
  return pages.map(pageContent => {
    // Extract the head content for styles
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    
    // Extract body attributes for stationery background compatibility
    const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
    const bodyAttributes = bodyMatch && bodyMatch[1] ? bodyMatch[1] : '';
    const originalBodyContent = bodyMatch && bodyMatch[2] ? bodyMatch[2] : '';
    
    // Reconstruct the stationery background if present
    let stationeryBackgroundHTML = '';
    const tempOriginalBodyDiv = document.createElement('div');
    tempOriginalBodyDiv.innerHTML = originalBodyContent;
    const stationeryBackgroundElement = tempOriginalBodyDiv.querySelector('.stationery-background');
    if (stationeryBackgroundElement) {
      stationeryBackgroundHTML = stationeryBackgroundElement.outerHTML;
    }

    // Create a complete HTML document for each page
    return `
      <!DOCTYPE html>
      <html>
      <head>
        ${headContent}
      </head>
      <body${bodyAttributes}>
        ${stationeryBackgroundHTML}
        <div class="content-wrapper">
          ${pageContent}
        </div>
      </body>
      </html>
    `;
  });
}

/**
 * Helper function to force split HTML into pages by artwork using DOMParser
 * Used when forceSplitPages is true for collections
 */
function splitForcePages(html: string): string[] {
  console.log("Attempting to force split HTML into pages by 'data-artwork-page-boundary' attribute.");
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc || !doc.head || !doc.body) {
    console.error("Failed to parse HTML string with DOMParser in splitForcePages. Returning original HTML as single page.");
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
  
  // Select artwork divs using the new data attribute from within the content wrapper
  const artworkElements = contentWrapperElement.querySelectorAll('div[data-artwork-page-boundary="true"]');
  console.log(`Found ${artworkElements.length} artwork elements with 'data-artwork-page-boundary="true"'.`);
  
  if (artworkElements.length === 0) {
    console.warn("No artwork elements found for splitting. The HTML might not contain the 'data-artwork-page-boundary' attribute or it's empty. Returning original HTML as single page.");
    return [html]; // Return original HTML if no elements to split
  }
  
  const pages: string[] = [];
  artworkElements.forEach((artworkElement, index) => {
    console.log(`Processing artwork element ${index + 1}: ${artworkElement.getAttribute('data-artwork-title') || 'Untitled Artwork'}`);
    const artworkHTML = artworkElement.outerHTML;
    
    // Create a complete HTML document for each page
    const pageHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        ${headHTML}
      </head>
      <body${bodyAttributes}>
        ${stationeryHTML}
        <div class="content-wrapper">
          ${artworkHTML}
        </div>
      </body>
      </html>
    `;
    pages.push(pageHTML);
  });
  
  if (pages.length > 0) {
    console.log(`Successfully split HTML into ${pages.length} pages using force split.`);
  } else {
    // This case should ideally not be reached if artworkElements.length > 0
    console.warn("Force splitting did not produce any pages, though artwork elements were found. This is unexpected. Returning original HTML.");
    return [html];
  }
  
  return pages;
}
