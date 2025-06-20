
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
   * Delete image record
   */
  static async deleteImage(imageId: string): Promise<boolean> {
    const { error } = await supabase
      .from('artwork_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      logger.error('[LocalImageService] Failed to delete image:', error);
      return false;
    }

    return true;
  }
}
