
import { Artwork } from "@/hooks/use-artworks";
import { generatePDFFromHTML } from "./pdf/pdf-utils";
import { generateArtworkHTML } from './pdf/generateArtworkHTML';

export async function createArtworkPDF(
  artwork: Artwork,
  templateStyle: string = 'basic',
  useStationery: boolean = false
): Promise<string> {
  console.log("Creating PDF for artwork:", artwork.title);
  
  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const safeArtworkTitle = artwork.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `artwork_${safeArtworkTitle}_${timestamp}_${randomStr}.pdf`;
  
  // Generate HTML content
  const htmlContent = generateArtworkHTML(artwork, templateStyle, useStationery);
  
  // Generate and return PDF
  return generatePDFFromHTML({
    html: htmlContent,
    fileName,
    entityType: 'artwork',
    entityId: artwork.id,
    entityTitle: artwork.title,
    description: `Datasheet for ${artwork.title}`
  });
}

