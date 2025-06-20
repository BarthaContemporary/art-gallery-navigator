
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface LocalImageRecord {
  id: string;
  artwork_id: string;
  original_storage_path?: string | null;
  thumbnail_storage_path?: string | null;
  medium_storage_path?: string | null;
  large_storage_path?: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string | null;
  is_primary?: boolean;
  display_order?: number;
  original_width?: number | null;
  original_height?: number | null;
}

export type ImageSize = 'thumbnail' | 'medium' | 'large' | 'original';

export class LocalImageService {
  private static cache = new Map<string, string>();

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
        const cacheKey = `${candidate.bucket}/${candidate.path}`;
        
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey)!;
        }

        const { data } = supabase.storage.from(candidate.bucket).getPublicUrl(candidate.path);
        if (data?.publicUrl) {
          this.cache.set(cacheKey, data.publicUrl);
          return data.publicUrl;
        }
      }
    }

    logger.warn(`[LocalImageService] No valid image paths found for image ${imageRecord.id}`);
    return '/placeholder.svg';
  }

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
      logger.error('[LocalImageService] Upload failed:', error);
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
    }
  }

  /**
   * Get images for an artwork
   */
  static async getArtworkImages(artworkId: string): Promise<LocalImageRecord[]> {
    const { data, error } = await supabase
      .from('artwork_images')
      .select(`
        id,
        artwork_id,
        original_storage_path,
        thumbnail_storage_path,
        medium_storage_path,
        large_storage_path,
        processing_status,
        processing_error,
        is_primary,
        display_order,
        original_width,
        original_height
      `)
      .eq('artwork_id', artworkId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('[LocalImageService] Failed to fetch artwork images:', error);
      return [];
    }

    // Type assertion to ensure proper typing after database query
    return (data || []).map(item => ({
      ...item,
      processing_status: item.processing_status as 'pending' | 'processing' | 'completed' | 'failed'
    }));
  }

  /**
   * Clear the URL cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get processing status summary for an artwork
   */
  static async getProcessingStatus(artworkId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const { data, error } = await supabase
      .from('artwork_images')
      .select('processing_status')
      .eq('artwork_id', artworkId);

    if (error || !data) {
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const counts = data.reduce((acc, item) => {
      const status = item.processing_status as 'pending' | 'processing' | 'completed' | 'failed';
      acc[status]++;
      return acc;
    }, { total: data.length, pending: 0, processing: 0, completed: 0, failed: 0 });

    return counts;
  }
}
