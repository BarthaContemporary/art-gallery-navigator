
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export class ImageUploadService {
  /**
   * Upload an image file and trigger processing
   */
  static async uploadAndProcessImage(
    file: File,
    artworkId: string,
    isPrimary: boolean = false,
    displayOrder: number = 0
  ): Promise<{ success: boolean; imageId?: string; error?: string }> {
    try {
      const imageId = crypto.randomUUID();
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const originalPath = `${artworkId}/${imageId}_original.${fileExtension}`;

      // Upload original to private bucket
      const { error: uploadError } = await supabase.storage
        .from('artwork-images-original')
        .upload(originalPath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Create database record
      const { error: dbError } = await supabase
        .from('artwork_images')
        .insert({
          id: imageId,
          artwork_id: artworkId,
          image_url: 'processing', // Legacy field, will be updated after processing
          original_storage_path: originalPath,
          processing_status: 'pending',
          is_primary: isPrimary,
          display_order: displayOrder,
          original_width: null,
          original_height: null
        });

      if (dbError) {
        throw dbError;
      }

      // Trigger background processing
      this.triggerImageProcessing(imageId, originalPath);

      return { success: true, imageId };
    } catch (error) {
      logger.error('[ImageUploadService] Upload failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Trigger background image processing
   */
  private static async triggerImageProcessing(imageId: string, originalPath: string) {
    try {
      // Update status to processing
      await supabase
        .from('artwork_images')
        .update({ processing_status: 'processing' })
        .eq('id', imageId);

      // Call edge function for processing
      const { error } = await supabase.functions.invoke('process-local-artwork-image', {
        body: {
          image_id: imageId,
          original_path: originalPath
        }
      });

      if (error) {
        logger.error('[ImageUploadService] Processing trigger failed:', error);
        await supabase
          .from('artwork_images')
          .update({ 
            processing_status: 'failed',
            processing_error: error.message 
          })
          .eq('id', imageId);
      }
    } catch (error) {
      logger.error('[ImageUploadService] Background processing failed:', error);
    }
  }
}
