
import { Artwork } from "@/hooks/use-artworks";
import { generateArtworkHTML } from "@/lib/pdf/generateArtworkHTML";
import { generatePDFFromHTML } from "@/lib/pdf/pdf-utils";
import { toast } from "sonner";

/**
 * Creates a PDF for an artwork
 */
export async function createArtworkPDF(
  artwork: Artwork,
  useStationery: boolean = true,
  options?: {
    addPageNumbers?: boolean;
    addTimeStamp?: boolean;
    orientation?: 'portrait' | 'landscape';
    artistName?: string; // Add artistName option
  }
): Promise<string> {
  try {
    // Generate HTML for the artwork, passing the actual artist name
    const html = await generateArtworkHTML(artwork, useStationery, options?.artistName);
    
    const fileName = `${options?.artistName || artwork.artist_name || 'Artist'} - ${artwork.title || 'Artwork'}.pdf`;
    
    // Generate PDF from HTML
    const pdfUrl = await generatePDFFromHTML({
      html,
      fileName,
      entityType: 'artwork',
      entityId: artwork.id,
      entityTitle: artwork.title || 'Artwork',
      description: `PDF for ${artwork.title} by ${options?.artistName || artwork.artist_name}`,
      addPageNumbers: options?.addPageNumbers || false,
      addTimeStamp: options?.addTimeStamp || false,
      orientation: options?.orientation || 'portrait'
    });
    
    return pdfUrl;
  } catch (error) {
    console.error("Error creating artwork PDF:", error);
    toast.error("Failed to create artwork PDF");
    throw error;
  }
}
