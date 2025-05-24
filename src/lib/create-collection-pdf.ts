
import { Collection } from "@/hooks/use-collections";
import { generateCollectionHTML } from "@/lib/pdf/generateCollectionHTML";
import { generatePDFFromHTML } from "@/lib/pdf/pdf-utils";
import { toast } from "sonner";

/**
 * Creates a PDF for a collection
 */
export async function createCollectionPDF(
  collection: Collection,
  templateStyle: string = 'classic',
  useStationery: boolean = true,
  options?: {
    addPageNumbers?: boolean;
    addTimeStamp?: boolean;
    orientation?: 'portrait' | 'landscape';
  }
): Promise<string> {
  try {
    // Generate HTML for the collection
    const html = await generateCollectionHTML(collection, templateStyle, useStationery);
    
    const fileName = `${collection.name || 'Collection'}.pdf`;
    
    // Add debug logging to track HTML content
    console.log("Generated collection HTML with artworks, checking for page-break markers");
    console.log("HTML contains page-break-before:", html.includes('page-break-before'));
    console.log("HTML contains page-break-after:", html.includes('page-break-after'));
    
    // Generate PDF from HTML
    const pdfUrl = await generatePDFFromHTML({
      html,
      fileName,
      entityType: 'collection',
      entityId: collection.id,
      entityTitle: collection.name || 'Collection',
      description: `PDF for collection: ${collection.name}`,
      addPageNumbers: options?.addPageNumbers || false,
      addTimeStamp: options?.addTimeStamp || true,
      orientation: options?.orientation || 'portrait',
      forceSplitPages: true  // Force the PDF generator to look for page breaks
    });
    
    return pdfUrl;
  } catch (error) {
    console.error("Error creating collection PDF:", error);
    toast.error("Failed to create collection PDF");
    throw error;
  }
}
