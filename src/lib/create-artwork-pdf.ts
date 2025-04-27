
import { Artwork } from "@/hooks/use-artworks";
import { generatePDFFromHTML } from "./pdf/pdf-utils";
import { generateArtworkHTML } from './pdf/generateArtworkHTML';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { preloadImage } from "./pdf/utils";

export async function createArtworkPDF(
  artwork: Artwork,
  templateStyle: string = 'classic',
  useStationery: boolean = false
): Promise<string> {
  console.log(`Creating PDF for artwork: ${artwork.title} with template: ${templateStyle} useStationery: ${useStationery}`);
  
  // Fetch artist name if not already available
  let artworkWithArtistName = { ...artwork };
  
  if (artwork.artist_id && !artwork.artist_name) {
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('full_name')
        .eq('id', artwork.artist_id)
        .single();
        
      if (!error && data) {
        artworkWithArtistName.artist_name = data.full_name;
        console.log("Retrieved artist name:", data.full_name);
      }
    } catch (error) {
      console.error("Error fetching artist name:", error);
      toast.error("Couldn't retrieve artist information");
    }
  }
  
  // Generate safe filename
  const safeArtistName = (artworkWithArtistName.artist_name || 'Unknown')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const safeArtworkTitle = artwork.title
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const fileName = `B_c-${safeArtistName}-${safeArtworkTitle}.pdf`;
  console.log("Generated filename:", fileName);
  
  // Log and preload image URL
  if (artwork.image_url) {
    console.log("Artwork has an image URL:", artwork.image_url);
    
    // Preload the image
    try {
      await preloadImage(artwork.image_url);
      console.log("Successfully preloaded artwork image");
    } catch (e) {
      console.error("Error preloading image:", e);
    }
  } else {
    console.log("Artwork has no image URL");
  }
  
  // Generate HTML content (now async)
  console.log("Generating HTML content");
  const htmlContent = await generateArtworkHTML(artworkWithArtistName, templateStyle, useStationery);
  
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
