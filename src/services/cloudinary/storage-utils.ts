
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ImageTier } from "./types";

export class CloudinaryStorageUtils {
  /**
   * Generate Supabase storage URL from storage path
   */
  static getSupabaseStorageUrl(storagePath: string, bucketName: string): string {
    if (!storagePath) return '/placeholder.svg';
    
    try {
      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);
      
      logger.log(`[CloudinaryStorageUtils] Generated storage URL: ${data.publicUrl} from path: ${storagePath}`);
      return data.publicUrl;
    } catch (error) {
      logger.error(`[CloudinaryStorageUtils] Failed to generate storage URL for path: ${storagePath}`, error);
      return '/placeholder.svg';
    }
  }

  /**
   * Get optimized storage URL from the processed images bucket
   */
  static getOptimizedStorageUrl(
    imageRecord: any,
    tier: ImageTier
  ): string | null {
    if (!imageRecord) return null;

    // Check if we have processed storage paths for optimized images
    const storagePathMap = {
      thumbnail: imageRecord.thumbnail_storage_path,
      medium: imageRecord.medium_storage_path,
      full: imageRecord.large_storage_path
    };

    const storagePath = storagePathMap[tier];
    if (!storagePath) return null;

    return this.getSupabaseStorageUrl(storagePath, 'artwork-images-processed');
  }
}
