
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { CloudinaryImageService } from "./cloudinary-image-service";

export class ImageReprocessingService {
  /**
   * Find artworks that have image_url but no corresponding artwork_images records
   */
  static async findArtworksNeedingImageProcessing(): Promise<any[]> {
    try {
      // Get artworks that have image_url but no artwork_images
      const { data: artworksWithImages, error: artworksError } = await supabase
        .from('artworks')
        .select('id, image_url, title')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .neq('image_url', '/placeholder.svg');

      if (artworksError) throw artworksError;

      if (!artworksWithImages || artworksWithImages.length === 0) {
        return [];
      }

      // Check which ones don't have artwork_images records
      const artworkIds = artworksWithImages.map(a => a.id);
      const { data: existingImages, error: imagesError } = await supabase
        .from('artwork_images')
        .select('artwork_id')
        .in('artwork_id', artworkIds);

      if (imagesError) throw imagesError;

      const artworksWithExistingImages = new Set(
        existingImages?.map(img => img.artwork_id) || []
      );

      // Return artworks that don't have artwork_images records
      const needingProcessing = artworksWithImages.filter(
        artwork => !artworksWithExistingImages.has(artwork.id)
      );

      logger.log(`[ImageReprocessingService] Found ${needingProcessing.length} artworks needing image processing`);
      return needingProcessing;

    } catch (error) {
      logger.error('[ImageReprocessingService] Error finding artworks needing processing:', error);
      return [];
    }
  }

  /**
   * Find artwork_images that failed processing or need reprocessing
   */
  static async findFailedImageProcessing(): Promise<any[]> {
    try {
      const { data: failedImages, error } = await supabase
        .from('artwork_images')
        .select('id, artwork_id, image_url, processing_status, processed')
        .or('processing_status.eq.failed,and(processed.eq.false,not.image_url.eq.processing)');

      if (error) throw error;

      logger.log(`[ImageReprocessingService] Found ${failedImages?.length || 0} failed image processing records`);
      return failedImages || [];

    } catch (error) {
      logger.error('[ImageReprocessingService] Error finding failed image processing:', error);
      return [];
    }
  }

  /**
   * Create artwork_images records for artworks that only have image_url
   */
  static async createMissingImageRecords(artworks: any[]): Promise<number> {
    let created = 0;

    for (const artwork of artworks) {
      try {
        const imageId = crypto.randomUUID();
        
        const { error } = await supabase
          .from('artwork_images')
          .insert({
            id: imageId,
            artwork_id: artwork.id,
            image_url: artwork.image_url,
            processing_status: 'pending',
            is_primary: true,
            display_order: 0,
            processed: false
          });

        if (error) {
          logger.error(`[ImageReprocessingService] Failed to create image record for artwork ${artwork.id}:`, error);
        } else {
          logger.log(`[ImageReprocessingService] Created image record ${imageId} for artwork ${artwork.title}`);
          created++;

          // Trigger processing
          CloudinaryImageService.triggerProcessing({
            id: imageId,
            image_url: artwork.image_url
          });
        }
      } catch (error) {
        logger.error(`[ImageReprocessingService] Error creating image record for artwork ${artwork.id}:`, error);
      }
    }

    return created;
  }

  /**
   * Retry processing for failed images
   */
  static async retryFailedProcessing(failedImages: any[]): Promise<number> {
    let retried = 0;

    for (const imageRecord of failedImages) {
      try {
        // Reset status to pending
        const { error: updateError } = await supabase
          .from('artwork_images')
          .update({
            processing_status: 'pending',
            processing_error: null
          })
          .eq('id', imageRecord.id);

        if (updateError) {
          logger.error(`[ImageReprocessingService] Failed to reset status for image ${imageRecord.id}:`, updateError);
          continue;
        }

        // Trigger reprocessing
        const success = await CloudinaryImageService.triggerProcessing(imageRecord);
        if (success) {
          logger.log(`[ImageReprocessingService] Triggered reprocessing for image ${imageRecord.id}`);
          retried++;
        }
      } catch (error) {
        logger.error(`[ImageReprocessingService] Error retrying processing for image ${imageRecord.id}:`, error);
      }
    }

    return retried;
  }

  /**
   * Run a complete reprocessing check and fix
   */
  static async runReprocessingCheck(): Promise<{
    artworksNeedingProcessing: number;
    failedImagesFound: number;
    recordsCreated: number;
    processingRetried: number;
  }> {
    logger.log('[ImageReprocessingService] Starting reprocessing check...');

    const [artworksNeedingProcessing, failedImages] = await Promise.all([
      this.findArtworksNeedingImageProcessing(),
      this.findFailedImageProcessing()
    ]);

    const recordsCreated = await this.createMissingImageRecords(artworksNeedingProcessing);
    const processingRetried = await this.retryFailedProcessing(failedImages);

    const result = {
      artworksNeedingProcessing: artworksNeedingProcessing.length,
      failedImagesFound: failedImages.length,
      recordsCreated,
      processingRetried
    };

    logger.log('[ImageReprocessingService] Reprocessing check complete:', result);
    return result;
  }
}
