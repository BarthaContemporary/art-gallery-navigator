
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
      
      // Get ALL artwork images, both processed and unprocessed
      // We need to reprocess images that don't have proper Cloudinary URLs
      const { data: allImages, error: artworkError } = await supabase
        .from('artwork_images')
        .select('id, image_url, processed')
        .or('processed.eq.false,not.image_url.like.%res.cloudinary.com%');

      if (artworkError) {
        throw artworkError;
      }

      // Get all artists with image_url that haven't been processed through Cloudinary
      const { data: artistsWithImages, error: artistError } = await supabase
        .from('artists')
        .select('id, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .not('image_url', 'like', '%res.cloudinary.com%');

      if (artistError) {
        throw artistError;
      }

      const artworkCount = allImages?.length || 0;
      const artistCount = artistsWithImages?.length || 0;
      const totalImages = artworkCount + artistCount;

      if (totalImages === 0) {
        toast.info("All images are already processed through Cloudinary");
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
      if (allImages && allImages.length > 0) {
        const batchSize = 3;
        for (let i = 0; i < allImages.length; i += batchSize) {
          const batch = allImages.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (image) => {
            try {
              setProgress(prev => ({ 
                ...prev, 
                current: `Processing artwork image ${image.id}...` 
              }));

              logger.log(`Processing image ${image.id} with URL: ${image.image_url}`);

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

              logger.log(`Successfully processed artwork image ${image.id}`, data);
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
          if (i + batchSize < allImages.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Process artist profile images
      if (artistsWithImages && artistsWithImages.length > 0) {
        for (const artist of artistsWithImages) {
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
        toast.success(`Successfully reconnected and optimized all ${totalProcessed} images through Cloudinary!`);
      } else {
        toast.warning(`Reconnected ${totalProcessed} images. ${totalFailed} images failed to process.`);
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
      // Count artwork images that either aren't processed OR don't have Cloudinary URLs
      const { count: artworkCount, error: artworkError } = await supabase
        .from('artwork_images')
        .select('*', { count: 'exact', head: true })
        .or('processed.eq.false,not.image_url.like.%res.cloudinary.com%');

      if (artworkError) {
        throw artworkError;
      }

      // Get artists with non-Cloudinary image URLs (unprocessed)
      const { data: artistsWithImages, error: artistError } = await supabase
        .from('artists')
        .select('image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .not('image_url', 'like', '%res.cloudinary.com%');

      if (artistError) {
        throw artistError;
      }

      const unprocessedArtists = artistsWithImages?.length || 0;

      return (artworkCount || 0) + unprocessedArtists;
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
