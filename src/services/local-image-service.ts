
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { ImageUploadService } from "./image-upload-service";
import { ImageUrlService } from "./image-url-service";

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
  /**
   * Get the best available image URL from local storage
   */
  static getBestImageUrl = ImageUrlService.getBestImageUrl;

  /**
   * Upload an image file and trigger processing
   */
  static uploadAndProcessImage = ImageUploadService.uploadAndProcessImage;

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
  static clearCache = ImageUrlService.clearCache;

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
