
import { supabase } from "@/integrations/supabase/client";
import { CloudinaryImageService } from "./cloudinary-image-service";
import { logger } from "@/lib/logger";

export class BackgroundImageProcessor {
  private static isProcessing = false;
  private static processingInterval: NodeJS.Timeout | null = null;

  static start(intervalMs: number = 30000) { // 30 seconds
    if (this.processingInterval) {
      this.stop();
    }

    this.processingInterval = setInterval(() => {
      this.processUnprocessedImages();
    }, intervalMs);

    // Process immediately on start
    this.processUnprocessedImages();
  }

  static stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  static async processUnprocessedImages() {
    if (this.isProcessing) {
      logger.log('[Background Processor] Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Fetch unprocessed images
      const { data: unprocessedImages, error } = await supabase
        .from('artwork_images')
        .select('*')
        .or('processed.is.null,processed.eq.false')
        .limit(5); // Process 5 at a time

      if (error) {
        logger.error('[Background Processor] Error fetching unprocessed images:', error);
        return;
      }

      if (!unprocessedImages || unprocessedImages.length === 0) {
        logger.log('[Background Processor] No unprocessed images found');
        return;
      }

      logger.log(`[Background Processor] Processing ${unprocessedImages.length} images`);

      // Process images concurrently
      const promises = unprocessedImages.map(async (image) => {
        try {
          await CloudinaryImageService.triggerProcessing(image);
          logger.log(`[Background Processor] Successfully queued processing for image ${image.id}`);
        } catch (error) {
          logger.error(`[Background Processor] Failed to process image ${image.id}:`, error);
        }
      });

      await Promise.allSettled(promises);

    } catch (error) {
      logger.error('[Background Processor] Unexpected error:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
