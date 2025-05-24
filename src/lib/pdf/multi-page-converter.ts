
import { toast } from "sonner";
import { MultiPagePDFBuilder } from "./pdf-builder";
import { splitHTMLIntoPages } from "./pdf-page-splitter";

interface ConvertHTMLToMultiPagePDFOptions {
  html: string;
  fileName: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  onProgress?: (message: string, percentage?: number) => void;
  forceSplitPages?: boolean;
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
}: ConvertHTMLToMultiPagePDFOptions): Promise<Blob> {
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
