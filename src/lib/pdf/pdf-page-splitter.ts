
import { splitByCSSPageBreaks } from './page-splitting/css-splitter';
import { splitByDataAttribute } from './page-splitting/forced-splitter';

/**
 * Splits HTML into separate pages based on page-break markers or forced splitting.
 * This is the main entry point for page splitting.
 */
export function splitHTMLIntoPages(html: string, forceSplitPages: boolean = false): string[] {
  if (forceSplitPages) {
    console.log("Force splitting HTML into multiple pages using 'splitByDataAttribute' method.");
    return splitByDataAttribute(html);
  }

  // Check if we should look for CSS page breaks
  // This check can be refined or made part of css-splitter if needed.
  const hasPageBreakHints = 
    html.includes('page-break-before') || html.includes('page-break-after') || 
    html.includes('break-before') || html.includes('break-after');

  if (!hasPageBreakHints) {
    console.log("No explicit page-break hints found in HTML via string search, attempting CSS-based split anyway or returning as single page if that yields nothing.");
    // Let css-splitter decide if it's a single page or if some styles are applied dynamically
    const cssSplitPages = splitByCSSPageBreaks(html);
    if (cssSplitPages.length > 1) {
        return cssSplitPages;
    }
    // If CSS split results in one page (or less, though less likely for valid HTML), 
    // and no explicit hints were found, it's likely a single page.
    console.log("CSS-based splitting yielded one page (or original HTML due to no breaks), treating as single page.");
    // The extractCommonHTMLParts and reconstructPageHTML are implicitly called by splitByCSSPageBreaks.
    // If splitByCSSPageBreaks returns [html] (original), it's already in full form.
    // If it processed and reconstructed a single page, that's also fine.
    return cssSplitPages.length > 0 ? cssSplitPages : [html]; 
  }
  
  return splitByCSSPageBreaks(html);
}

