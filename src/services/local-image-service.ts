
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type ImageSize = 'thumbnail' | 'medium' | 'large' | 'original';

export interface LocalImageRecord {
  id: string;
  artwork_id: string;
  original_storage_path?: string | null;
  thumbnail_storage_path?: string | null;
  medium_storage_path?: string | null;
  large_storage_path?: string | null;
  processing_status?: string | null;
  processing_error?: string | null;
  is_primary: boolean;
  display_order: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
  medium_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  original_width?: number | null;
  original_height?: number | null;
  thumbnail_width?: number | null;
  thumbnail_height?: number | null;
  medium_width?: number | null;
  medium_height?: number | null;
}

export class LocalImageService {
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

      logger.log(`[LocalImageService] Starting upload for ${file.name}, size: ${file.size} bytes`);

      // Upload original to private bucket
      const { error: uploadError } = await supabase.storage
        .from('artwork-images-original')
        .upload(originalPath, file);

      if (uploadError) {
        logger.error(`[LocalImageService] Upload error:`, uploadError);
        throw uploadError;
      }

      logger.log(`[LocalImageService] Original file uploaded to: ${originalPath}`);

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
        logger.error(`[LocalImageService] Database error:`, dbError);
        throw dbError;
      }

      logger.log(`[LocalImageService] Database record created with ID: ${imageId}`);

      // Trigger background processing
      this.triggerImageProcessing(imageId, originalPath);

      return { success: true, imageId };
    } catch (error) {
      logger.error('[LocalImageService] Upload failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Trigger background image processing
   */
  private static async triggerImageProcessing(imageId: string, originalPath: string) {
    try {
      logger.log(`[LocalImageService] Triggering processing for image ${imageId}`);
      
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
        logger.error('[LocalImageService] Processing trigger failed:', error);
        await supabase
          .from('artwork_images')
          .update({ 
            processing_status: 'failed',
            processing_error: error.message 
          })
          .eq('id', imageId);
      } else {
        logger.log(`[LocalImageService] Processing triggered successfully for image ${imageId}`);
      }
    } catch (error) {
      logger.error('[LocalImageService] Background processing failed:', error);
    }
  }

  /**
   * Get all images for an artwork
   */
  static async getArtworkImages(artworkId: string): Promise<LocalImageRecord[]> {
    try {
      const { data, error } = await supabase
        .from('artwork_images')
        .select('*')
        .eq('artwork_id', artworkId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('[LocalImageService] Failed to fetch images:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('[LocalImageService] Get artwork images failed:', error);
      return [];
    }
  }

  /**
   * Get the best available image URL for display
   */
  static getBestImageUrl(imageRecord: LocalImageRecord, preferredSize: ImageSize = 'medium'): string {
    // If still processing, return placeholder
    if (imageRecord.processing_status === 'pending' || imageRecord.processing_status === 'processing') {
      return '/placeholder.svg';
    }

    // Try to get the preferred size first
    switch (preferredSize) {
      case 'thumbnail':
        if (imageRecord.thumbnail_url && imageRecord.thumbnail_url !== '/placeholder.svg') {
          return imageRecord.thumbnail_url;
        }
        break;
      case 'medium':
        if (imageRecord.medium_url && imageRecord.medium_url !== '/placeholder.svg') {
          return imageRecord.medium_url;
        }
        break;
      case 'large':
        if (imageRecord.image_url && imageRecord.image_url !== '/placeholder.svg') {
          return imageRecord.image_url;
        }
        break;
    }

    // Fallback hierarchy: image_url -> medium_url -> thumbnail_url -> placeholder
    if (imageRecord.image_url && imageRecord.image_url !== '/placeholder.svg') {
      return imageRecord.image_url;
    }
    if (imageRecord.medium_url && imageRecord.medium_url !== '/placeholder.svg') {
      return imageRecord.medium_url;
    }
    if (imageRecord.thumbnail_url && imageRecord.thumbnail_url !== '/placeholder.svg') {
      return imageRecord.thumbnail_url;
    }

    return '/placeholder.svg';
  }

  /**
   * Get processing status for an artwork
   */
  static async getProcessingStatus(artworkId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('artwork_images')
        .select('processing_status')
        .eq('artwork_id', artworkId);

      if (error) {
        logger.error('[LocalImageService] Failed to fetch processing status:', error);
        return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
      }

      const status = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
      
      data?.forEach(image => {
        status.total++;
        switch (image.processing_status) {
          case 'pending':
            status.pending++;
            break;
          case 'processing':
            status.processing++;
            break;
          case 'completed':
            status.completed++;
            break;
          case 'failed':
            status.failed++;
            break;
        }
      });

      return status;
    } catch (error) {
      logger.error('[LocalImageService] Get processing status failed:', error);
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Delete an image and its storage files
   */
  static async deleteImage(imageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get image record first
      const { data: imageRecord, error: fetchError } = await supabase
        .from('artwork_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchError || !imageRecord) {
        throw new Error('Image record not found');
      }

      // Delete from storage buckets
      const deletePromises = [];

      if (imageRecord.original_storage_path) {
        deletePromises.push(
          supabase.storage.from('artwork-images-original').remove([imageRecord.original_storage_path])
        );
      }

      if (imageRecord.thumbnail_storage_path) {
        deletePromises.push(
          supabase.storage.from('artwork-images-processed').remove([imageRecord.thumbnail_storage_path])
        );
      }

      if (imageRecord.medium_storage_path) {
        deletePromises.push(
          supabase.storage.from('artwork-images-processed').remove([imageRecord.medium_storage_path])
        );
      }

      if (imageRecord.large_storage_path) {
        deletePromises.push(
          supabase.storage.from('artwork-images-processed').remove([imageRecord.large_storage_path])
        );
      }

      // Wait for all storage deletions
      await Promise.all(deletePromises);

      // Delete database record
      const { error: dbError } = await supabase
        .from('artwork_images')
        .delete()
        .eq('id', imageId);

      if (dbError) {
        throw dbError;
      }

      logger.log(`[LocalImageService] Successfully deleted image ${imageId}`);
      return { success: true };
    } catch (error) {
      logger.error('[LocalImageService] Delete failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
    }
  }
}
