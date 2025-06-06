
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { BulkProcessingProgress } from "./types";
import { getUnprocessedCounts, getUnprocessedCountForDisplay } from "./utils";
import { processArtworkImagesBatch } from "./artwork-processor";
import { processArtistProfileImages } from "./artist-processor";

export type { BulkProcessingProgress };

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
      
      const { artworkCount, artistCount, totalImages } = await getUnprocessedCounts();

      if (totalImages === 0) {
        toast.info("No unprocessed images found");
        setProgress(prev => ({ ...prev, isRunning: false }));
        return;
      }

      // Get the actual data for processing
      const { data: unprocessedImages } = await supabase
        .from('artwork_images')
        .select('id, image_url')
        .eq('processed', false);

      const { data: artistsWithImages } = await supabase
        .from('artists')
        .select('id, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '');

      const unprocessedArtists = artistsWithImages?.filter(artist => 
        artist.image_url && !artist.image_url.includes('res.cloudinary.com')
      ) || [];

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
        const artworkResults = await processArtworkImagesBatch(
          unprocessedImages,
          (p, f, current) => {
            processed = p;
            failed = f;
            setProgress(prev => ({
              ...prev,
              processed,
              failed,
              current,
            }));
          }
        );
        processed = artworkResults.processed;
        failed = artworkResults.failed;
      }

      // Process artist profile images (only unprocessed ones)
      if (unprocessedArtists.length > 0) {
        const artistResults = await processArtistProfileImages(
          unprocessedArtists,
          (p, f, current) => {
            artistsProcessed = p;
            artistsFailed = f;
            setProgress(prev => ({
              ...prev,
              artistsProcessed,
              artistsFailed,
              current,
            }));
          }
        );
        artistsProcessed = artistResults.processed;
        artistsFailed = artistResults.failed;
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
    return getUnprocessedCountForDisplay();
  }, []);

  return {
    progress,
    processAllImages,
    getUnprocessedCount
  };
}
