
import { Artwork } from "@/hooks/use-artworks";
import { generatePDFFromHTML } from "./pdf/pdf-utils";
import { generateArtworkHTML } from './pdf/generateArtworkHTML';
import { supabase } from "@/integrations/supabase/client";

export async function createArtworkPDF(
  artwork: Artwork,
  templateStyle: string = 'basic',
  useStationery: boolean = false
): Promise<string> {
  console.log("Creating PDF for artwork:", artwork.title);
  
  // Fetch artist name if available
  let artworkWithArtistName = { ...artwork };
  
  if (artwork.artist_id) {
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('full_name')
        .eq('id', artwork.artist_id)
        .single();
        
      if (!error && data) {
        artworkWithArtistName.artist_name = data.full_name;
      }
    } catch (error) {
      console.error("Error fetching artist name:", error);
    }
  }
  
  // Generate filename in the format B_c-[Artist Name]-[Work Title].pdf
  const safeArtistName = (artworkWithArtistName.artist_name || 'Unknown')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const safeArtworkTitle = artwork.title
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const fileName = `B_c-${safeArtistName}-${safeArtworkTitle}.pdf`;
  
  // Generate HTML content
  const htmlContent = generateArtworkHTML(artworkWithArtistName, templateStyle, useStationery);
  
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

