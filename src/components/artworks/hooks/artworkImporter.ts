
import { supabase } from "@/integrations/supabase/client";
import { ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";
import { ImportStats } from "@/components/artworks/import-steps/types";

type ArtworkInsertData = Omit<ProcessedArtworkForImport, 'id' | 'artist_name'>;

export async function performArtworkImport(
  artworksToImport: ProcessedArtworkForImport[],
  onProgress: (progress: number) => void,
  onStatsUpdate: (stats: Pick<ImportStats, 'successful' | 'failed'>) => void
): Promise<Pick<ImportStats, 'successful' | 'failed'>> {
  let successful = 0;
  let failed = 0;
  const total = artworksToImport.length;

  for (let i = 0; i < total; i++) {
    const artwork = artworksToImport[i];
    const { id, artist_name, ...artworkFieldsToInsert } = artwork;
    
    const dataToInsert: ArtworkInsertData = {
      ...artworkFieldsToInsert,
      title: artworkFieldsToInsert.title!,
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
    onStatsUpdate({ successful, failed });
  }
  
  return { successful, failed };
}
