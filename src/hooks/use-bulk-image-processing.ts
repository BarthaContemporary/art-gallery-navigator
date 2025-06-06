
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
  artistsTotal?: number;
  artistsProcessed?: number;
  artistsFailed?: number;
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
      const { data: unprocessedImages, error: artworkError } = await supabase
        .from('artwork_images')
        .select('id, image_url')
        .eq('processed', false);

      if (artworkError) {
        throw artworkError;
      }

      // Get all artists with image_url that haven't been processed through Cloudinary
      // Check if the image_url contains 'res.cloudinary.com' to determine if it's already processed
      const { data: artistsWithImages, error: artistError } = await supabase
        .from('artists')
        .select('id, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '');

      if (artistError) {
        throw artistError;
      }

      // Filter out artists whose images are already processed through Cloudinary
      const unprocessedArtists = artistsWithImages?.filter(artist => 
        artist.image_url && !artist.image_url.includes('res.cloudinary.com')
      ) || [];

      const artworkCount = unprocessedImages?.length || 0;
      const artistCount = unprocessedArtists.length;
      const totalImages = artworkCount + artistCount;

      if (totalImages === 0) {
        toast.info("No unprocessed images found");
        setProgress(prev => ({ ...prev, isRunning: false }));
        return;
      }

      setProgress({
        total: artworkCount,
        processed: 0,
        failed: 0,
        artistsTotal: artistCount,
        artistsProcessed: 0,
        artistsFailed: 0,
        isRunning: true
      });

      logger.log(`Starting bulk processing of ${totalImages} images (${artworkCount} artworks, ${artistCount} artists)`);
      toast.info(`Starting optimization of ${totalImages} images through Cloudinary`);

      let processed = 0;
      let failed = 0;
      let artistsProcessed = 0;
      let artistsFailed = 0;

      // Process artwork images first
      if (unprocessedImages && unprocessedImages.length > 0) {
        const batchSize = 3;
        for (let i = 0; i < unprocessedImages.length; i += batchSize) {
          const batch = unprocessedImages.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (image) => {
            try {
              setProgress(prev => ({ 
                ...prev, 
                current: `Processing artwork image ${image.id}...` 
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

          setProgress(prev => ({
            ...prev,
            processed,
            failed,
            current: `Processed ${processed + failed} of ${artworkCount} artwork images`,
          }));

          // Small delay between batches
          if (i + batchSize < unprocessedImages.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Process artist profile images (only unprocessed ones)
      if (unprocessedArtists.length > 0) {
        for (const artist of unprocessedArtists) {
          try {
            setProgress(prev => ({ 
              ...prev, 
              current: `Processing artist profile image for ${artist.id}...` 
            }));

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

            const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
              body: { 
                image_url: artist.image_url, 
                artwork_image_id: tempImageRecord.id,
                options: {
                  quality: 95,
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

          setProgress(prev => ({
            ...prev,
            artistsProcessed,
            artistsFailed,
            current: `Processed ${artistsProcessed + artistsFailed} of ${artistCount} artist profile images`,
          }));

          // Small delay between artist images
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress({
        total: artworkCount,
        processed,
        failed,
        artistsTotal: artistCount,
        artistsProcessed,
        artistsFailed,
        current: undefined,
        isRunning: false
      });

      const totalProcessed = processed + artistsProcessed;
      const totalFailed = failed + artistsFailed;

      if (totalFailed === 0) {
        toast.success(`Successfully optimized all ${totalProcessed} images through Cloudinary!`);
      } else {
        toast.warning(`Optimized ${totalProcessed} images. ${totalFailed} images failed to process.`);
      }

      logger.log(`Bulk processing completed. Artworks - Processed: ${processed}, Failed: ${failed}. Artists - Processed: ${artistsProcessed}, Failed: ${artistsFailed}`);

    } catch (error) {
      logger.error('Bulk image processing failed:', error);
      toast.error('Failed to start bulk image processing');
      setProgress(prev => ({ ...prev, isRunning: false }));
    }
  }, []);

  const getUnprocessedCount = useCallback(async () => {
    try {
      const { count: artworkCount, error: artworkError } = await supabase
        .from('artwork_images')
        .select('*', { count: 'exact', head: true })
        .eq('processed', false);

      if (artworkError) {
        throw artworkError;
      }

      // Get artists with non-Cloudinary image URLs (unprocessed)
      const { data: artistsWithImages, error: artistError } = await supabase
        .from('artists')
        .select('image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '');

      if (artistError) {
        throw artistError;
      }

      const unprocessedArtists = artistsWithImages?.filter(artist => 
        artist.image_url && !artist.image_url.includes('res.cloudinary.com')
      ) || [];

      return (artworkCount || 0) + unprocessedArtists.length;
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
