
import { supabase } from "@/integrations/supabase/client";
import { ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStats } from "@/components/artworks/import-steps/types";
import { toast } from "sonner";

type ArtworkInsertData = Omit<ProcessedArtworkForImport, 'id' | 'artist_name'>;

export async function performArtworkImport(
  artworksToImport: ProcessedArtworkForImport[],
  onProgress: (progress: number) => void,
  onStatsUpdate: (stats: Pick<ImportStats, 'successful' | 'failed' | 'skipped'>) => void
): Promise<Pick<ImportStats, 'successful' | 'failed' | 'skipped'>> {
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const total = artworksToImport.length;

  for (let i = 0; i < total; i++) {
    const artwork = artworksToImport[i];
    const { id, artist_name, ...artworkFieldsToInsert } = artwork;
    
    // Duplicate Check: Exact title match with same artist
    // Ensure title is not null or empty for the check
    if (artwork.title && artwork.title.trim() !== "") {
      const { data: existingArtwork, error: checkError } = await supabase
        .from("artworks")
        .select("id")
        .eq("title", artwork.title)
        // artist_id can be null, so the check should handle that.
        // If artwork.artist_id is null, eq will correctly search for artist_id IS NULL.
        .eq("artist_id", artwork.artist_id) 
        .maybeSingle();

      if (checkError) {
        console.error("Error checking for duplicate artwork:", artwork.title, checkError);
        toast.warning(`Error checking duplicate for ${artwork.title}. Will attempt import.`);
        // Decide if this should count as a fail or if we proceed. For now, proceed.
      } else if (existingArtwork) {
        console.log("Duplicate found, skipping artwork:", artwork.title, "Artist ID:", artwork.artist_id);
        skipped++;
        onProgress(((i + 1) / total) * 100);
        onStatsUpdate({ successful, failed, skipped });
        continue; // Skip to the next artwork
      }
    } else {
      // If title is empty or null, it's hard to define a duplicate based on title.
      // For now, we'll proceed with import attempt, it might fail validation later or be hard to identify.
      // Alternatively, we could count this as a "failed" or "skipped" due to insufficient data.
      // Let's proceed with import and let DB constraints or later logic handle it.
      console.warn("Artwork title is empty, cannot perform reliable duplicate check based on title:", artwork);
    }
    
    const dataToInsert: ArtworkInsertData = {
      ...artworkFieldsToInsert,
      title: artworkFieldsToInsert.title!, // Already checked artwork.title is not empty. Or use default?
      classification: artworkFieldsToInsert.classification!,
      medium_type: artworkFieldsToInsert.medium_type!,
      currency: artworkFieldsToInsert.currency!,
    };

    try {
      const { error } = await supabase.from("artworks").insert(dataToInsert as any); 
                                                                                    
      if (error) {
        console.error("Error importing artwork:", artwork.title, error);
        failed++;
      } else {
        successful++;
      }
    } catch (dbError) {
      console.error("Database Error importing artwork:", artwork.title, dbError);
      failed++;
    }
    
    onProgress(((i + 1) / total) * 100);
    onStatsUpdate({ successful, failed, skipped });
  }
  
  return { successful, failed, skipped };
}
