
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { LocalImageRecord } from "./local-image-service";

export class ImageRepairService {
  /**
   * Find images with failed processing status
   */
  static async findFailedImages(): Promise<LocalImageRecord[]> {
    const { data, error } = await supabase
      .from('artwork_images')
      .select('*')
      .eq('processing_status', 'failed');

    if (error) {
      logger.error('[ImageRepairService] Failed to fetch failed images:', error);
      return [];
    }

    return data as LocalImageRecord[];
  }

  /**
   * Find images stuck in processing status for too long
   */
  static async findStuckImages(minutesThreshold: number = 30): Promise<LocalImageRecord[]> {
    const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('artwork_images')
      .select('*')
      .in('processing_status', ['pending', 'processing'])
      .lt('created_at', thresholdTime);

    if (error) {
      logger.error('[ImageRepairService] Failed to fetch stuck images:', error);
      return [];
    }

    return data as LocalImageRecord[];
  }

  /**
   * Retry processing for a specific image
   */
  static async retryImageProcessing(imageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get image record
      const { data: imageData, error: fetchError } = await supabase
        .from('artwork_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchError || !imageData) {
        return { success: false, error: 'Image not found' };
      }

      if (!imageData.original_storage_path) {
        return { success: false, error: 'No original image path found' };
      }

      // Reset status to pending
      const { error: resetError } = await supabase
        .from('artwork_images')
        .update({ 
          processing_status: 'pending',
          processing_error: null 
        })
        .eq('id', imageId);

      if (resetError) {
        return { success: false, error: `Failed to reset status: ${resetError.message}` };
      }

      // Trigger processing
      const { error: processError } = await supabase.functions.invoke('process-local-artwork-image', {
        body: {
          image_id: imageId,
          original_path: imageData.original_storage_path
        }
      });

      if (processError) {
        return { success: false, error: `Failed to trigger processing: ${processError.message}` };
      }

      logger.log(`[ImageRepairService] Triggered retry for image ${imageId}`);
      return { success: true };

    } catch (error) {
      logger.error('[ImageRepairService] Retry failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Retry failed' 
      };
    }
  }

  /**
   * Batch retry multiple images
   */
  static async batchRetryImages(imageIds: string[]): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const imageId of imageIds) {
      const result = await this.retryImageProcessing(imageId);
      if (result.success) {
        successful.push(imageId);
      } else {
        failed.push({ id: imageId, error: result.error || 'Unknown error' });
      }
      
      // Add small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { successful, failed };
  }

  /**
   * Clean up orphaned image records (no original file)
   */
  static async cleanupOrphanedRecords(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = [];
    let cleaned = 0;

    try {
      // Get all image records
      const { data: images, error } = await supabase
        .from('artwork_images')
        .select('id, original_storage_path')
        .not('original_storage_path', 'is', null);

      if (error) {
        errors.push(`Failed to fetch images: ${error.message}`);
        return { cleaned, errors };
      }

      for (const image of images || []) {
        try {
          // Check if original file exists
          const { error: downloadError } = await supabase.storage
            .from('artwork-images-original')
            .download(image.original_storage_path);

          if (downloadError && downloadError.message.includes('not found')) {
            // File doesn't exist, remove the record
            const { error: deleteError } = await supabase
              .from('artwork_images')
              .delete()
              .eq('id', image.id);

            if (deleteError) {
              errors.push(`Failed to delete orphaned record ${image.id}: ${deleteError.message}`);
            } else {
              cleaned++;
              logger.log(`[ImageRepairService] Cleaned orphaned record ${image.id}`);
            }
          }
        } catch (error) {
          errors.push(`Error checking image ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      errors.push(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { cleaned, errors };
  }

  /**
   * Get processing status summary for all images
   */
  static async getProcessingStatusSummary(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    stuck: number;
  }> {
    const { data, error } = await supabase
      .from('artwork_images')
      .select('processing_status, created_at');

    if (error || !data) {
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 };
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const summary = data.reduce((acc, item) => {
      acc.total++;
      
      const status = item.processing_status as 'pending' | 'processing' | 'completed' | 'failed';
      acc[status]++;
      
      // Count stuck images (processing/pending for > 30 minutes)
      if ((status === 'pending' || status === 'processing') && 
          new Date(item.created_at) < thirtyMinutesAgo) {
        acc.stuck++;
      }
      
      return acc;
    }, { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 });

    return summary;
  }
}
