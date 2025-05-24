
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface PageOptions {
  header?: string;
  footer?: string;
  pageNumber?: number;
  totalPages?: number;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'legal';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

interface MultiPagePDFOptions {
  fileName: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  defaultMargins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  onProgress?: (message: string, percentage?: number) => void;
}

/**
 * Creates a PDF document with multiple pages
 */
export class MultiPagePDFBuilder {
  private pdf: jsPDF;
  private pageContents: Array<{html: string, options?: PageOptions}> = [];
  private options: MultiPagePDFOptions;
  private pageWidth: number;
  private pageHeight: number;
  private dimensions: { width: string; height: string };

  constructor(options: MultiPagePDFOptions) {
    this.options = {
      pageSize: 'a4',
      orientation: 'portrait',
      defaultMargins: { top: 10, right: 10, bottom: 10, left: 10 },
      ...options
    };

    // Initialize PDF object
    this.pdf = new jsPDF({
      orientation: this.options.orientation,
      unit: 'mm',
      format: this.options.pageSize,
      compress: true
    });

    // Set dimensions based on orientation and page size
    const pageDimensions = this.getPageDimensions();
    this.pageWidth = pageDimensions.width;
    this.pageHeight = pageDimensions.height;
    this.dimensions = {
      width: `${this.pageWidth}mm`,
      height: `${this.pageHeight}mm`
    };
    
    console.log(`PDF initialized with dimensions: ${this.pageWidth}mm x ${this.pageHeight}mm`);
  }

  /**
   * Add a page to the PDF
   */
  addPage(html: string, options?: PageOptions): void {
    this.pageContents.push({ html, options });
    console.log(`Added page ${this.pageContents.length} to PDF document`);
  }

  /**
   * Add multiple pages to the PDF
   */
  addPages(pages: Array<{html: string, options?: PageOptions}>): void {
    this.pageContents.push(...pages);
    console.log(`Added ${pages.length} pages to PDF document`);
  }

  /**
   * Get dimensions for the PDF based on orientation and page size
   */
  private getPageDimensions(): { width: number; height: number } {
    const isPortrait = this.options.orientation === 'portrait';
    
    switch (this.options.pageSize) {
      case 'letter':
        return isPortrait ? { width: 215.9, height: 279.4 } : { width: 279.4, height: 215.9 };
      case 'legal':
        return isPortrait ? { width: 215.9, height: 355.6 } : { width: 355.6, height: 215.9 };
      case 'a4':
      default:
        return isPortrait ? { width: 210, height: 297 } : { width: 297, height: 210 };
    }
  }

  /**
   * Build the PDF from all added pages
   */
  async build(): Promise<Blob> {
    if (this.pageContents.length === 0) {
      throw new Error("No pages added to the PDF");
    }

    const { onProgress } = this.options;
    onProgress?.("Preparing to build PDF...");
    
    // First page doesn't need to add a new page
    let isFirstPage = true;

    // Process each page
    for (let i = 0; i < this.pageContents.length; i++) {
      const { html, options } = this.pageContents[i];
      const pageNumber = i + 1;
      const totalPages = this.pageContents.length;
      
      onProgress?.(`Rendering page ${pageNumber} of ${totalPages}...`, (i / this.pageContents.length) * 100);
      console.log(`Rendering page ${pageNumber} of ${totalPages}`);
      
      try {
        // Generate image for this page
        const pageBlob = await this.renderPageToImage(html, {
          ...options,
          pageNumber,
          totalPages
        });
        
        // Add new page if this isn't the first page
        if (!isFirstPage) {
          this.pdf.addPage();
        } else {
          isFirstPage = false;
        }
        
        // Add page content
        this.pdf.addImage(
          pageBlob, 
          'JPEG', 
          0, 
          0, 
          this.pageWidth, 
          this.pageHeight
        );
        
        console.log(`Added page ${pageNumber} to PDF`);
      } catch (error) {
        console.error(`Error rendering page ${pageNumber}:`, error);
        toast.error(`Error rendering page ${pageNumber}`);
      }
    }

    onProgress?.("Finalizing PDF...", 95);
    
    // Generate and return the PDF as a blob
    const pdfBlob = this.pdf.output('blob');
    onProgress?.("PDF created successfully!", 100);
    
    return pdfBlob;
  }

  /**
   * Render a single page's HTML to an image
   */
  private async renderPageToImage(html: string, options?: PageOptions): Promise<string> {
    // Create container for the page
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = this.dimensions.width;
    container.style.height = this.dimensions.height;
    container.style.backgroundColor = 'white';
    container.style.overflow = 'hidden';
    container.style.zIndex = '-1000';
    document.body.appendChild(container);
    
    try {
      // Apply page headers/footers if provided
      let fullHtml = html;
      
      if (options?.header) {
        fullHtml = `<div class="pdf-page-header">${options.header}</div>${fullHtml}`;
      }
      
      if (options?.footer || options?.pageNumber) {
        let footerContent = options.footer || '';
        if (options.pageNumber && options.totalPages) {
          footerContent += `<div class="pdf-page-number">Page ${options.pageNumber} of ${options.totalPages}</div>`;
        }
        fullHtml = `${fullHtml}<div class="pdf-page-footer">${footerContent}</div>`;
      }
      
      // Add common page styles
      const pageStyles = `
        @page { size: ${this.options.pageSize} ${this.options.orientation}; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; } }
        body { 
          margin: 0; 
          padding: 0; 
          width: ${this.dimensions.width}; 
          height: ${this.dimensions.height};
          font-family: 'Source Sans 3', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .pdf-page-header {
          position: absolute;
          top: ${options?.margins?.top || this.options.defaultMargins?.top || 10}mm;
          left: ${options?.margins?.left || this.options.defaultMargins?.left || 10}mm;
          right: ${options?.margins?.right || this.options.defaultMargins?.right || 10}mm;
          z-index: 1000;
        }
        .pdf-page-footer {
          position: absolute;
          bottom: ${options?.margins?.bottom || this.options.defaultMargins?.bottom || 10}mm;
          left: ${options?.margins?.left || this.options.defaultMargins?.left || 10}mm;
          right: ${options?.margins?.right || this.options.defaultMargins?.right || 10}mm;
          z-index: 1000;
          font-size: 9pt;
        }
        .pdf-page-number {
          text-align: center;
          font-size: 8pt;
          color: #666;
        }
      `;
      
      // Add HTML content with styles to container
      container.innerHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${pageStyles}</style>
          </head>
          <body>${fullHtml}</body>
        </html>
      `;
      
      // Force layout calculation
      container.offsetHeight;
      
      // Wait for images and fonts
      await this.waitForResources(container);
      
      // Render the page to canvas
      const canvas = await html2canvas(container, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        onclone: (clonedDoc) => {
          const images = clonedDoc.querySelectorAll('img');
          
          // Process each image
          images.forEach((img) => {
            img.crossOrigin = "Anonymous";
            img.style.maxWidth = '100%';
            img.style.opacity = '1';
            img.style.display = 'block';
            img.style.visibility = 'visible';
          });
        }
      });
      
      // Return the canvas as image data
      return canvas.toDataURL('image/jpeg', 0.95);
    } finally {
      // Clean up
      document.body.removeChild(container);
    }
  }

  /**
   * Waits for all resources (images, fonts) to load
   */
  private async waitForResources(container: HTMLElement): Promise<void> {
    // Wait for images
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) return;
    
    // Preload each image with proper CORS settings
    const imagePromises = images.map((img) => {
      // If image is already loaded, no need to wait
      if (img.complete && img.naturalHeight !== 0) {
        return Promise.resolve();
      }
      
      return new Promise<void>((resolve) => {
        // Handle successful load
        img.onload = () => resolve();
        
        // Handle failed load
        img.onerror = () => {
          console.warn(`Failed to load image: ${img.src.substring(0, 50)}...`);
          // Resolve anyway to continue with PDF generation
          resolve();
        };
        
        // Set CORS attribute
        img.crossOrigin = "Anonymous";
        
        // Reload the image to trigger the events
        const currentSrc = img.src;
        img.src = "";
        img.src = currentSrc;
      });
    });
    
    // Wait for all images to load or fail
    await Promise.all(imagePromises);
    
    // Additional wait for fonts and layout
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * Helper function to convert HTML to a multi-page PDF
 */
export async function convertHTMLToMultiPagePDF({ 
  html,
  fileName,
  onProgress = () => {},
  pageSize = 'a4',
  orientation = 'portrait',
  forceSplitPages = false
}: {
  html: string;
  fileName: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  onProgress?: (message: string, percentage?: number) => void;
  forceSplitPages?: boolean;
}): Promise<Blob> {
  onProgress("Preparing document...");
  console.log("Starting multi-page PDF conversion process");
  
  try {
    // Extract page content based on page-break markers
    const pageContents = splitHTMLIntoPages(html, forceSplitPages);
    console.log(`Split HTML into ${pageContents.length} pages`);
    
    onProgress("Setting up pages...", 10);
    
    // Create PDF builder
    const pdfBuilder = new MultiPagePDFBuilder({
      fileName,
      pageSize,
      orientation,
      onProgress
    });
    
    // Add each page to the PDF
    pageContents.forEach((pageHTML) => {
      pdfBuilder.addPage(pageHTML);
    });
    
    // Build and return the PDF
    return await pdfBuilder.build();
    
  } catch (error) {
    console.error("Error creating multi-page PDF:", error);
    toast.error(`Failed to create PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Splits HTML into separate pages based on page-break markers
 */
function splitHTMLIntoPages(html: string, forceSplitPages: boolean = false): string[] {
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
    // Check for page break styles
    const hasPageBreakBefore = 
      element.classList.contains('page-break-before') || 
      element.style.pageBreakBefore === 'always' ||
      element.style.breakBefore === 'page' ||
      (element.getAttribute('style') || '').includes('page-break-before') ||
      (element.getAttribute('style') || '').includes('break-before');
    
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
    currentPage.appendChild(element.cloneNode(true));
    currentPageContent = currentPage.innerHTML;
    
    // Check for page break after
    const hasPageBreakAfter = 
      element.classList.contains('page-break-after') || 
      element.style.pageBreakAfter === 'always' ||
      element.style.breakAfter === 'page' ||
      (element.getAttribute('style') || '').includes('page-break-after') ||
      (element.getAttribute('style') || '').includes('break-after');
    
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
    
    // Create a complete HTML document for each page
    return `
      <!DOCTYPE html>
      <html>
      <head>
        ${headContent}
      </head>
      <body>
        ${bodyContent.innerHTML.includes('stationery-background') ? 
          bodyContent.querySelector('.stationery-background')?.outerHTML || '' : ''}
        <div class="content-wrapper">
          ${pageContent}
        </div>
      </body>
      </html>
    `;
  });
}

