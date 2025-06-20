
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type ImageSize = 'thumbnail' | 'medium' | 'large' | 'original';

export interface LocalImageRecord {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number | null;
  original_width: number | null;
  original_height: number | null;
  original_size: number | null;
  original_storage_path: string | null;
  thumbnail_storage_path: string | null;
  medium_storage_path: string | null;
  large_storage_path: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export class LocalImageService {
  /**
   * Get all images for a specific artwork
   */
  static async getArtworkImages(artworkId: string): Promise<LocalImageRecord[]> {
    const { data, error } = await supabase
      .from('artwork_images')
      .select('*')
      .eq('artwork_id', artworkId)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('[LocalImageService] Failed to fetch artwork images:', error);
      throw error;
    }

    return data as LocalImageRecord[];
  }

  /**
   * Get processing status summary for an artwork
   */
  static async getProcessingStatus(artworkId: string) {
    const { data, error } = await supabase
      .from('artwork_images')
      .select('processing_status')
      .eq('artwork_id', artworkId);

    if (error) {
      logger.error('[LocalImageService] Failed to get processing status:', error);
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const summary = data.reduce((acc, item) => {
      acc.total++;
      const status = item.processing_status as 'pending' | 'processing' | 'completed' | 'failed';
      acc[status]++;
      return acc;
    }, { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });

    return summary;
  }

  /**
   * Get the primary image for an artwork
   */
  static async getPrimaryImage(artworkId: string): Promise<LocalImageRecord | null> {
    const { data, error } = await supabase
      .from('artwork_images')
      .select('*')
      .eq('artwork_id', artworkId)
      .eq('is_primary', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No primary image found, get first image
        const { data: firstImage } = await supabase
          .from('artwork_images')
          .select('*')
          .eq('artwork_id', artworkId)
          .order('display_order', { ascending: true })
          .limit(1)
          .single();
        
        return firstImage as LocalImageRecord || null;
      }
      logger.error('[LocalImageService] Failed to get primary image:', error);
      return null;
    }

    return data as LocalImageRecord;
  }

  /**
   * Get the best available image URL from local storage
   */
  static getBestImageUrl(imageRecord: LocalImageRecord, preferredSize: ImageSize = 'medium'): string {
    if (!imageRecord) {
      return '/placeholder.svg';
    }

    // Build priority list based on preferred size
    const urlCandidates: Array<{ path: string | null | undefined; bucket: string }> = [];

    // Add preferred size first
    switch (preferredSize) {
      case 'thumbnail':
        urlCandidates.push({ path: imageRecord.thumbnail_storage_path, bucket: 'artwork-images-processed' });
        break;
      case 'medium':
        urlCandidates.push({ path: imageRecord.medium_storage_path, bucket: 'artwork-images-processed' });
        break;
      case 'large':
        urlCandidates.push({ path: imageRecord.large_storage_path, bucket: 'artwork-images-processed' });
        break;
      case 'original':
        urlCandidates.push({ path: imageRecord.original_storage_path, bucket: 'artwork-images-original' });
        break;
    }

    // Add fallbacks in quality order
    urlCandidates.push(
      { path: imageRecord.large_storage_path, bucket: 'artwork-images-processed' },
      { path: imageRecord.medium_storage_path, bucket: 'artwork-images-processed' },
      { path: imageRecord.thumbnail_storage_path, bucket: 'artwork-images-processed' },
      { path: imageRecord.original_storage_path, bucket: 'artwork-images-original' }
    );

    // Find first valid path and generate public URL
    for (const candidate of urlCandidates) {
      if (candidate.path) {
        const { data } = supabase.storage.from(candidate.bucket).getPublicUrl(candidate.path);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      }
    }

    logger.warn(`[LocalImageService] No valid image paths found for image ${imageRecord.id}`);
    return '/placeholder.svg';
  }

  /**
   * Upload an image file and trigger processing with proper error handling
   */
  static async uploadAndProcessImage(
    file: File,
    artworkId: string,
    isPrimary: boolean = false,
    displayOrder: number = 0
  ): Promise<{ success: boolean; imageId?: string; error?: string }> {
    const imageId = crypto.randomUUID();
    
    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        throw new Error('File size must be less than 100MB');
      }

      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExtension)) {
        throw new Error('Unsupported file format. Please use JPG, PNG, WebP, or GIF');
      }

      const originalPath = `${artworkId}/${imageId}_original.${fileExtension}`;

      // Create database record first to ensure consistency
      const { error: dbError } = await supabase
        .from('artwork_images')
        .insert({
          id: imageId,
          artwork_id: artworkId,
          image_url: 'processing',
          original_storage_path: originalPath,
          processing_status: 'pending',
          is_primary: isPrimary,
          display_order: displayOrder,
          original_width: null,
          original_height: null,
          original_size: file.size
        });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Upload original to private bucket
      const { error: uploadError } = await supabase.storage
        .from('artwork-images-original')
        .upload(originalPath, file);

      if (uploadError) {
        // Clean up database record if upload fails
        await supabase
          .from('artwork_images')
          .delete()
          .eq('id', imageId);
        
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Trigger background processing
      this.triggerImageProcessing(imageId, originalPath);

      logger.log(`[LocalImageService] Successfully uploaded image ${imageId}`);
      return { success: true, imageId };

    } catch (error) {
      logger.error('[LocalImageService] Upload failed:', error);
      
      // Try to clean up any partial data
      try {
        await supabase.from('artwork_images').delete().eq('id', imageId);
      } catch (cleanupError) {
        logger.warn('[LocalImageService] Failed to cleanup after upload error:', cleanupError);
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Trigger background image processing with improved error handling
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
        logger.error('[LocalImageService] Processing trigger failed:', error);
        await supabase
          .from('artwork_images')
          .update({ 
            processing_status: 'failed',
            processing_error: error.message 
          })
          .eq('id', imageId);
      }
    } catch (error) {
      logger.error('[LocalImageService] Background processing failed:', error);
      
      // Mark as failed if we can't even trigger processing
      try {
        await supabase
          .from('artwork_images')
          .update({ 
            processing_status: 'failed',
            processing_error: 'Failed to trigger image processing'
          })
          .eq('id', imageId);
      } catch (updateError) {
        logger.error('[LocalImageService] Failed to update error status:', updateError);
      }
    }
  }

  /**
   * Update image record
   */
  static async updateImage(imageId: string, updates: Partial<LocalImageRecord>): Promise<boolean> {
    const { error } = await supabase
      .from('artwork_images')
      .update(updates)
      .eq('id', imageId);

    if (error) {
      logger.error('[LocalImageService] Failed to update image:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete image record and associated files
   */
  static async deleteImage(imageId: string): Promise<boolean> {
    try {
      // Get image record first to clean up files
      const { data: imageRecord } = await supabase
        .from('artwork_images')
        .select('*')
        .eq('id', imageId)
        .single();

      // Delete from database
      const { error } = await supabase
        .from('artwork_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        logger.error('[LocalImageService] Failed to delete image record:', error);
        return false;
      }

      // Clean up storage files (best effort)
      if (imageRecord) {
        const filesToDelete: Array<{ bucket: string; path: string }> = [];
        
        if (imageRecord.original_storage_path) {
          filesToDelete.push({ bucket: 'artwork-images-original', path: imageRecord.original_storage_path });
        }
        if (imageRecord.thumbnail_storage_path) {
          filesToDelete.push({ bucket: 'artwork-images-processed', path: imageRecord.thumbnail_storage_path });
        }
        if (imageRecord.medium_storage_path) {
          filesToDelete.push({ bucket: 'artwork-images-processed', path: imageRecord.medium_storage_path });
        }
        if (imageRecord.large_storage_path) {
          filesToDelete.push({ bucket: 'artwork-images-processed', path: imageRecord.large_storage_path });
        }

        // Delete files in background (don't wait for completion)
        for (const file of filesToDelete) {
          supabase.storage.from(file.bucket).remove([file.path]).catch(error => {
            logger.warn(`[LocalImageService] Failed to delete storage file ${file.path}:`, error);
          });
        }
      }

      return true;
    } catch (error) {
      logger.error('[LocalImageService] Failed to delete image:', error);
      return false;
    }
  }
}
