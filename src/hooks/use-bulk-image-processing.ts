
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface BulkProcessingProgress {
  total: number;
  processed: number;
  failed: number;
  current?: string;
  isRunning: boolean;
}

export function useBulkImageProcessing() {
  const [progress, setProgress] = useState<BulkProcessingProgress>({
    total: 0,
    processed: 0,
    failed: 0,
    isRunning: false
  });

  const processAllImages = useCallback(async () => {
    try {
      setProgress(prev => ({ ...prev, isRunning: true }));
      
      // Get all unprocessed artwork images
      const { data: unprocessedImages, error } = await supabase
        .from('artwork_images')
        .select('id, image_url')
        .eq('processed', false);

      if (error) {
        throw error;
      }

      if (!unprocessedImages || unprocessedImages.length === 0) {
        toast.info("No unprocessed images found");
        setProgress(prev => ({ ...prev, isRunning: false }));
        return;
      }

      const total = unprocessedImages.length;
      setProgress({
        total,
        processed: 0,
        failed: 0,
        isRunning: true
      });

      logger.log(`Starting bulk processing of ${total} images`);
      toast.info(`Starting optimization of ${total} images through Cloudinary`);

      let processed = 0;
      let failed = 0;

      // Process images in batches to avoid overwhelming the system
      const batchSize = 3;
      for (let i = 0; i < unprocessedImages.length; i += batchSize) {
        const batch = unprocessedImages.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (image) => {
          try {
            setProgress(prev => ({ 
              ...prev, 
              current: `Processing image ${image.id}...` 
            }));

            const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
              body: { 
                image_url: image.image_url, 
                artwork_image_id: image.id,
                options: {
                  quality: 90,
                  format: 'webp',
                  sharpen: true,
                  autoOrient: true,
                  watermark: false
                }
              }
            });

            if (error || !data.success) {
              throw new Error(data?.error || 'Processing failed');
            }

            logger.log(`Successfully processed image ${image.id}`);
            return { success: true, id: image.id };
          } catch (error) {
            logger.error(`Failed to process image ${image.id}:`, error);
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

        setProgress({
          total,
          processed,
          failed,
          current: `Processed ${processed + failed} of ${total} images`,
          isRunning: true
        });

        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < unprocessedImages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setProgress({
        total,
        processed,
        failed,
        current: undefined,
        isRunning: false
      });

      if (failed === 0) {
        toast.success(`Successfully optimized all ${processed} images through Cloudinary!`);
      } else {
        toast.warning(`Optimized ${processed} images. ${failed} images failed to process.`);
      }

      logger.log(`Bulk processing completed. Processed: ${processed}, Failed: ${failed}`);

    } catch (error) {
      logger.error('Bulk image processing failed:', error);
      toast.error('Failed to start bulk image processing');
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  }, []);

  const getUnprocessedCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('artwork_images')
        .select('*', { count: 'exact', head: true })
        .eq('processed', false);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('Failed to get unprocessed count:', error);
      return 0;
    }
  }, []);

  return {
    progress,
    processAllImages,
    getUnprocessedCount
  };
}
