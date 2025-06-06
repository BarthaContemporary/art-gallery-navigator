
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { ProcessingOptions } from "./types";

export async function processArtistProfileImages(
  artists: Array<{ id: string; image_url: string }>,
  onProgress: (processed: number, failed: number, current?: string) => void
): Promise<{ processed: number; failed: number }> {
  let artistsProcessed = 0;
  let artistsFailed = 0;

  for (const artist of artists) {
    try {
      onProgress(artistsProcessed, artistsFailed, `Processing artist profile image for ${artist.id}...`);

      // Create a temporary artwork_images record for the artist profile
      const { data: tempImageRecord, error: insertError } = await supabase
        .from('artwork_images')
        .insert({
          image_url: artist.image_url,
          processed: false
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const options: ProcessingOptions = {
        quality: 95,
        format: 'webp',
        sharpen: true,
        autoOrient: true,
        watermark: false
      };

      const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
        body: { 
          image_url: artist.image_url, 
          artwork_image_id: tempImageRecord.id,
          options
        }
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Processing failed');
      }

      // Update the artist with the processed image URL
      const { error: updateError } = await supabase
        .from('artists')
        .update({ image_url: data.processed_url })
        .eq('id', artist.id);

      if (updateError) {
        throw updateError;
      }

      // Clean up the temporary record
      await supabase
        .from('artwork_images')
        .delete()
        .eq('id', tempImageRecord.id);

      artistsProcessed++;
      logger.log(`Successfully processed artist profile image ${artist.id}`);

    } catch (error) {
      artistsFailed++;
      logger.error(`Failed to process artist profile image ${artist.id}:`, error);
    }

    onProgress(artistsProcessed, artistsFailed, `Processed ${artistsProcessed + artistsFailed} of ${artists.length} artist profile images`);

    // Small delay between artist images
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { processed: artistsProcessed, failed: artistsFailed };
}
