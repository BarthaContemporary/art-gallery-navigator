
import jsPDF from "jspdf";
import { toast } from "sonner";
import { PageOptions, MultiPagePDFOptions } from "./pdf-types";
import { calculatePageDimensions } from "./pdf-page-dimension-utils";
import { renderHTMLPageToImage } from "./pdf-renderer";

/**
 * Creates a PDF document with multiple pages
 */
export class MultiPagePDFBuilder {
  private pdf: jsPDF;
  private pageContents: Array<{html: string, options?: PageOptions}> = [];
  private options: MultiPagePDFOptions;
  private pageWidth: number; // in mm
  private pageHeight: number; // in mm
  private pageDimensionsMM: { width: string; height: string }; // e.g. "210mm"

  constructor(options: MultiPagePDFOptions) {
    this.options = {
      pageSize: 'a4',
      orientation: 'portrait',
      defaultMargins: { top: 10, right: 10, bottom: 10, left: 10 },
      ...options
    };

    this.pdf = new jsPDF({
      orientation: this.options.orientation,
      unit: 'mm',
      format: this.options.pageSize,
      compress: true
    });

    const { width, height } = calculatePageDimensions(this.options.pageSize, this.options.orientation);
    this.pageWidth = width;
    this.pageHeight = height;
    this.pageDimensionsMM = {
      width: `${this.pageWidth}mm`,
      height: `${this.pageHeight}mm`
    };
    
    console.log(`PDF initialized with dimensions: ${this.pageWidth}mm x ${this.pageHeight}mm`);
  }

  addPage(html: string, options?: PageOptions): void {
    this.pageContents.push({ html, options });
    console.log(`Added page ${this.pageContents.length} to PDF document`);
  }

  addPages(pages: Array<{html: string, options?: PageOptions}>): void {
    this.pageContents.push(...pages);
    console.log(`Added ${pages.length} pages to PDF document`);
  }

  async build(): Promise<Blob> {
    if (this.pageContents.length === 0) {
      throw new Error("No pages added to the PDF");
    }

    const { onProgress } = this.options;
    onProgress?.("Preparing to build PDF...");
    
    let isFirstPage = true;

    for (let i = 0; i < this.pageContents.length; i++) {
      const { html, options: pageSpecificOptions } = this.pageContents[i];
      const pageNumber = i + 1;
      const totalPages = this.pageContents.length;
      
      onProgress?.(`Rendering page ${pageNumber} of ${totalPages}...`, (i / this.pageContents.length) * 100);
      console.log(`Rendering page ${pageNumber} of ${totalPages}`);
      
      try {
        const imageRenderOptions = {
          ...pageSpecificOptions,
          pageNumber,
          totalPages
        };

        const pageBlob = await renderHTMLPageToImage({
          html,
          pageOptions: imageRenderOptions,
          pageDimensions: this.pageDimensionsMM,
          pdfBaseOptions: {
            pageSize: this.options.pageSize,
            orientation: this.options.orientation,
            defaultMargins: this.options.defaultMargins,
          }
        });
        
        if (!isFirstPage) {
          this.pdf.addPage();
        } else {
          isFirstPage = false;
        }
        
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
        // Decide if we should throw or continue
        // For now, let's rethrow to be consistent with original behavior if a page fails badly
        if (error instanceof Error) throw error;
        throw new Error(`Unknown error rendering page ${pageNumber}`);
      }
    }

    onProgress?.("Finalizing PDF...", 95);
    
    const pdfBlob = this.pdf.output('blob');
    onProgress?.("PDF created successfully!", 100);
    
    return pdfBlob;
  }
}

