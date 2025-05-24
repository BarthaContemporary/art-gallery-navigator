
/**
 * Splits HTML into separate pages based on page-break markers
 */
export function splitHTMLIntoPages(html: string, forceSplitPages: boolean = false): string[] {
  // Check if we should look for page breaks
  if (!forceSplitPages && !html.includes('page-break-before') && !html.includes('page-break-after') && 
      !html.includes('break-before') && !html.includes('break-after')) {
    console.log("No page breaks found in HTML, using as single page");
    return [html];
  }
  
  console.log("Attempting to split HTML into multiple pages");
  
  // Create a temporary container to analyze the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const pages: string[] = [];
  let currentPageContent = '';
  let currentPage = document.createElement('div');
  
  // Process all elements in the body
  const bodyContent = tempDiv.querySelector('body');
  if (!bodyContent) {
    console.warn("Could not find body element in HTML");
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
  if (pages.length === 0) {
    console.warn("Could not split HTML into pages, using as single page");
    return [html];
  }
  
  console.log(`Successfully split HTML into ${pages.length} pages`);
  
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
