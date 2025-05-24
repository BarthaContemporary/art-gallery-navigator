
import { MultiPagePDFOptions } from "./pdf-types";

/**
 * Get dimensions for the PDF based on orientation and page size
 */
export function calculatePageDimensions(
  pageSize: MultiPagePDFOptions['pageSize'] = 'a4',
  orientation: MultiPagePDFOptions['orientation'] = 'portrait'
): { width: number; height: number } {
  const isPortrait = orientation === 'portrait';
  
  switch (pageSize) {
    case 'letter':
      return isPortrait ? { width: 215.9, height: 279.4 } : { width: 279.4, height: 215.9 };
    case 'legal':
      return isPortrait ? { width: 215.9, height: 355.6 } : { width: 355.6, height: 215.9 };
    case 'a4':
    default:
      return isPortrait ? { width: 210, height: 297 } : { width: 297, height: 210 };
  }
}

