
import { toast } from "sonner";
import { convertHTMLToMultiPagePDF } from "./multi-page-pdf";

interface EnhancedHTMLToPDFOptions {
  html: string;
  fileName: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  onProgress?: (message: string, percentage?: number) => void;
  addPageNumbers?: boolean;
  addTimeStamp?: boolean;
  forceSplitPages?: boolean;
}

/**
 * Enhanced version of HTML to PDF conversion that handles multi-page documents
 */
export async function convertEnhancedHTMLToPDF({
  html,
  fileName,
  pageSize = 'a4',
  orientation = 'portrait',
  onProgress = () => {},
  addPageNumbers = false,
  addTimeStamp = false,
  forceSplitPages = false
}: EnhancedHTMLToPDFOptions): Promise<Blob> {
  console.log("Starting enhanced PDF conversion process");
  
  try {
    // Add page numbering CSS if requested
    let enhancedHtml = html;
    
    if (addPageNumbers) {
      enhancedHtml = addPageNumberingCSS(enhancedHtml);
    }
    
    if (addTimeStamp) {
      enhancedHtml = addTimeStampHTML(enhancedHtml);
    }
    
    // Process any additional page break hints
    enhancedHtml = processPageBreakHints(enhancedHtml);
    
    // Convert using multi-page handler
    return await convertHTMLToMultiPagePDF({
      html: enhancedHtml,
      fileName,
      pageSize,
      orientation,
      onProgress,
      forceSplitPages
    });
    
  } catch (error) {
    console.error("Error creating enhanced PDF:", error);
    toast.error(`Failed to create PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Add CSS for page numbering
 */
function addPageNumberingCSS(html: string): string {
  const style = `
    <style>
      @page {
        @bottom-right {
          content: counter(page) " of " counter(pages);
        }
      }
      .page-break-after {
        page-break-after: always;
        break-after: page;
      }
      .page-break-before {
        page-break-before: always;
        break-before: page;
      }
      .avoid-break {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    </style>
  `;
  
  return html.replace('</head>', `${style}</head>`);
}

/**
 * Add timestamp to the document
 */
function addTimeStampHTML(html: string): string {
  const timestamp = new Date().toLocaleString();
  const timestampHTML = `
    <div class="pdf-timestamp" style="position: absolute; bottom: 5mm; left: 10mm; font-size: 8pt; color: #999;">
      Generated on: ${timestamp}
    </div>
  `;
  
  return html.replace('</body>', `${timestampHTML}</body>`);
}

/**
 * Process page break hints (elements with className or data attributes for page breaks)
 */
function processPageBreakHints(html: string): string {
  // This is a simple implementation that converts class-based hints to inline style
  let processedHtml = html;
  
  // Convert .page-break class to inline style
  processedHtml = processedHtml.replace(/class="([^"]*)page-break-after([^"]*)"/g, 
    'class="$1$2" style="page-break-after: always;"');
  
  processedHtml = processedHtml.replace(/class="([^"]*)page-break-before([^"]*)"/g, 
    'class="$1$2" style="page-break-before: always;"');
  
  processedHtml = processedHtml.replace(/class="([^"]*)avoid-break([^"]*)"/g, 
    'class="$1$2" style="page-break-inside: avoid;"');
  
  return processedHtml;
}
