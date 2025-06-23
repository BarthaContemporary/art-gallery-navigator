
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { LocalImageRecord, ImageSize } from "./local-image-service";

export class SimplifiedImageUrlResolver {
  private static urlCache = new Map<string, string>();

  /**
   * Get the best available image URL with a simplified, reliable approach
   */
  static getBestImageUrl(imageRecord: LocalImageRecord | null | undefined, preferredSize: ImageSize = 'medium'): string {
    if (!imageRecord) {
      logger.warn('[SimplifiedImageUrlResolver] No image record provided');
      return '/placeholder.svg';
    }

    const cacheKey = `${imageRecord.id}-${preferredSize}`;
    if (this.urlCache.has(cacheKey)) {
      return this.urlCache.get(cacheKey)!;
    }

    logger.log(`[SimplifiedImageUrlResolver] Resolving URL for image ${imageRecord.id}, preferred size: ${preferredSize}`);

    // Priority 1: Try processed storage paths (public bucket)
    const processedUrl = this.getProcessedStorageUrl(imageRecord, preferredSize);
    if (processedUrl) {
      this.urlCache.set(cacheKey, processedUrl);
      logger.log(`[SimplifiedImageUrlResolver] Using processed storage URL: ${processedUrl}`);
      return processedUrl;
    }

    // Priority 2: Try original storage path (private bucket, but accessible to authenticated users)
    if (imageRecord.original_storage_path) {
      const originalUrl = this.getSupabaseStorageUrl(imageRecord.original_storage_path, 'artwork-images-original');
      if (originalUrl !== '/placeholder.svg') {
        this.urlCache.set(cacheKey, originalUrl);
        logger.log(`[SimplifiedImageUrlResolver] Using original storage URL: ${originalUrl}`);
        return originalUrl;
      }
    }

    // Priority 3: Legacy image_url from artworks table
    if (imageRecord.image_url && 
        imageRecord.image_url !== 'processing' && 
        imageRecord.image_url !== '/placeholder.svg') {
      this.urlCache.set(cacheKey, imageRecord.image_url);
      logger.log(`[SimplifiedImageUrlResolver] Using legacy image URL: ${imageRecord.image_url}`);
      return imageRecord.image_url;
    }

    // Final fallback
    logger.warn(`[SimplifiedImageUrlResolver] No valid URL found for image ${imageRecord.id}, using placeholder`);
    return '/placeholder.svg';
  }

  /**
   * Get processed storage URL based on size preference
   */
  private static getProcessedStorageUrl(imageRecord: LocalImageRecord, preferredSize: ImageSize): string | null {
    const pathMap = {
      thumbnail: imageRecord.thumbnail_storage_path,
      medium: imageRecord.medium_storage_path,
      large: imageRecord.large_storage_path,
      original: imageRecord.large_storage_path // Use large for original in processed bucket
    };

    // Try preferred size first
    const preferredPath = pathMap[preferredSize];
    if (preferredPath) {
      const url = this.getSupabaseStorageUrl(preferredPath, 'artwork-images-processed');
      if (url !== '/placeholder.svg') return url;
    }

    // Try fallback sizes in order of preference
    const fallbackOrder: ImageSize[] = ['large', 'medium', 'thumbnail'];
    for (const size of fallbackOrder) {
      if (size === preferredSize) continue; // Already tried
      const path = pathMap[size];
      if (path) {
        const url = this.getSupabaseStorageUrl(path, 'artwork-images-processed');
        if (url !== '/placeholder.svg') return url;
      }
    }

    return null;
  }

  /**
   * Generate Supabase storage URL from storage path
   */
  private static getSupabaseStorageUrl(storagePath: string, bucketName: string): string {
    if (!storagePath) return '/placeholder.svg';
    
    try {
      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);
      
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } catch (error) {
      logger.error(`[SimplifiedImageUrlResolver] Failed to generate storage URL for path: ${storagePath}`, error);
    }
    
    return '/placeholder.svg';
  }

  /**
   * Clear the URL cache
   */
  static clearCache(): void {
    this.urlCache.clear();
  }

  /**
   * Get fallback sizes in order of preference
   */
  static getFallbackSizes(requestedSize: ImageSize): ImageSize[] {
    const sizeHierarchy: ImageSize[] = ['original', 'large', 'medium', 'thumbnail'];
    const requestedIndex = sizeHierarchy.indexOf(requestedSize);
    
    if (requestedIndex === -1) return sizeHierarchy;
    
    // Start from requested size and include all sizes
    return sizeHierarchy.slice(requestedIndex);
  }
}
