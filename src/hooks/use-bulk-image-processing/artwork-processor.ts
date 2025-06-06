
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { ProcessingOptions } from "./types";

export async function processArtworkImagesBatch(
  images: Array<{ id: string; image_url: string }>,
  onProgress: (processed: number, failed: number, current?: string) => void
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  const batchSize = 3;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (image) => {
      try {
        onProgress(processed, failed, `Processing artwork image ${image.id}...`);

        const options: ProcessingOptions = {
          quality: 90,
          format: 'webp',
          sharpen: true,
          autoOrient: true,
          watermark: false
        };

        const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
          body: { 
            image_url: image.image_url, 
            artwork_image_id: image.id,
            options
          }
        });

        if (error || !data.success) {
          throw new Error(data?.error || 'Processing failed');
        }

        logger.log(`Successfully processed artwork image ${image.id}`);
        return { success: true, id: image.id };
      } catch (error) {
        logger.error(`Failed to process artwork image ${image.id}:`, error);
        return { success: false, id: image.id, error };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    });

    onProgress(processed, failed, `Processed ${processed + failed} of ${images.length} artwork images`);

    // Small delay between batches
    if (i + batchSize < images.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { processed, failed };
}
