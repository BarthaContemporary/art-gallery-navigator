
/**
 * Utility functions to detect CSS page-break properties on an HTMLElement.
 */

/**
 * Checks if an element has a CSS page-break-before instruction.
 * This includes class-based, style-based, and direct attribute checks.
 */
export function hasPageBreakBefore(element: HTMLElement): boolean {
  const styleAttribute = element.getAttribute('style') || '';
  return (
    element.classList.contains('page-break-before') ||
    element.style.pageBreakBefore === 'always' ||
    element.style.breakBefore === 'page' ||
    styleAttribute.includes('page-break-before:') || // More specific check for inline styles
    styleAttribute.includes('break-before: page')   // More specific check for inline styles
  );
}

/**
 * Checks if an element has a CSS page-break-after instruction.
 * This includes class-based, style-based, and direct attribute checks.
 */
export function hasPageBreakAfter(element: HTMLElement): boolean {
  const styleAttribute = element.getAttribute('style') || '';
  return (
    element.classList.contains('page-break-after') ||
    element.style.pageBreakAfter === 'always' ||
    element.style.breakAfter === 'page' ||
    styleAttribute.includes('page-break-after:') || // More specific check for inline styles
    styleAttribute.includes('break-after: page')   // More specific check for inline styles
  );
}

