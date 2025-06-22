
import { logger } from "@/lib/logger";
import { CloudinaryUrlOptimizer } from "./url-optimizer";
import { CloudinaryStorageUtils } from "./storage-utils";
import type { ImageTier } from "./types";

export class CloudinaryBestUrlResolver {
  static getBestAvailableUrl(
    imageRecord: any, 
    tier: ImageTier
  ): string {
    if (!imageRecord) {
      return '/placeholder.svg';
    }

    // First priority: processed Cloudinary URLs stored in database
    if (imageRecord.processed) {
      switch (tier) {
        case 'thumbnail':
          if (imageRecord.thumbnail_url) return imageRecord.thumbnail_url;
          break;
        case 'medium':
          if (imageRecord.medium_url) return imageRecord.medium_url;
          break;
        case 'full':
          if (imageRecord.image_url && imageRecord.image_url.includes('res.cloudinary.com')) {
            return imageRecord.image_url;
          }
          break;
      }
    }

    // Second priority: original image URL (direct or via Cloudinary optimization)
    if (imageRecord.image_url) {
      // If Cloudinary is configured, try to optimize the original URL
      if (CloudinaryUrlOptimizer.isCloudinaryConfigured()) {
        return CloudinaryUrlOptimizer.getOptimizedUrl(imageRecord.image_url, tier);
      }
      // Otherwise return the original URL
      return imageRecord.image_url;
    }

    // Fallback to placeholder
    return '/placeholder.svg';
  }

  /**
   * Get the best available image URL with improved fallback hierarchy
   */
  static getBestImageUrl(
    imageRecord: any,
    tier: ImageTier
  ): string {
    if (!imageRecord) {
      logger.warn('[CloudinaryBestUrlResolver] No image record provided');
      return '/placeholder.svg';
    }

    logger.log(`[CloudinaryBestUrlResolver] Getting best image URL for tier: ${tier}`, {
      id: imageRecord.id,
      processed: imageRecord.processed,
      thumbnail_storage_path: imageRecord.thumbnail_storage_path,
      medium_storage_path: imageRecord.medium_storage_path,
      large_storage_path: imageRecord.large_storage_path,
      thumbnail_url: imageRecord.thumbnail_url,
      medium_url: imageRecord.medium_url,
      image_url: imageRecord.image_url
    });

    // Handle legacy image records (from artworks.image_url fallback)
    if (imageRecord.id?.startsWith('legacy-')) {
      const legacyUrl = imageRecord.image_url;
      if (legacyUrl && legacyUrl !== '/placeholder.svg') {
        // For legacy images, try to optimize if Cloudinary is configured
        if (CloudinaryUrlOptimizer.isCloudinaryConfigured()) {
          logger.log(`[CloudinaryBestUrlResolver] Using optimized legacy URL: ${legacyUrl}`);
          return CloudinaryUrlOptimizer.getOptimizedUrl(legacyUrl, tier);
        }
        logger.log(`[CloudinaryBestUrlResolver] Using legacy URL as-is: ${legacyUrl}`);
        return legacyUrl;
      }
    }

    // 1. Try optimized storage URLs first (from processed bucket)
    const optimizedStorageUrl = CloudinaryStorageUtils.getOptimizedStorageUrl(imageRecord, tier);
    if (optimizedStorageUrl && optimizedStorageUrl !== '/placeholder.svg') {
      logger.log(`[CloudinaryBestUrlResolver] Using optimized storage URL: ${optimizedStorageUrl}`);
      return optimizedStorageUrl;
    }

    // 2. Try original storage path if available
    if (imageRecord.original_storage_path) {
      const originalStorageUrl = CloudinaryStorageUtils.getSupabaseStorageUrl(
        imageRecord.original_storage_path, 
        'artwork-images-original'
      );
      if (originalStorageUrl && originalStorageUrl !== '/placeholder.svg') {
        logger.log(`[CloudinaryBestUrlResolver] Using original storage URL: ${originalStorageUrl}`);
        return originalStorageUrl;
      }
    }

    // 3. Try Cloudinary URLs from database
    if (imageRecord.processed) {
      const cloudinaryUrl = this.getBestAvailableUrl(imageRecord, tier);
      if (cloudinaryUrl !== '/placeholder.svg') {
        logger.log(`[CloudinaryBestUrlResolver] Using Cloudinary URL: ${cloudinaryUrl}`);
        return cloudinaryUrl;
      }
    }

    // 4. Fallback to original image with Cloudinary optimization
    if (imageRecord.image_url && 
        imageRecord.image_url !== 'processing' && 
        imageRecord.image_url !== '/placeholder.svg' &&
        CloudinaryUrlOptimizer.isCloudinaryConfigured()) {
      const optimizedUrl = CloudinaryUrlOptimizer.getOptimizedUrl(imageRecord.image_url, tier);
      logger.log(`[CloudinaryBestUrlResolver] Using optimized original URL: ${optimizedUrl}`);
      return optimizedUrl;
    }

    // 5. Last resort: original image URL if valid
    if (imageRecord.image_url && 
        imageRecord.image_url !== 'processing' && 
        imageRecord.image_url !== '/placeholder.svg') {
      logger.log(`[CloudinaryBestUrlResolver] Using original image URL: ${imageRecord.image_url}`);
      return imageRecord.image_url;
    }

    logger.warn('[CloudinaryBestUrlResolver] No valid image URL found, returning placeholder');
    return '/placeholder.svg';
  }

  /**
   * Check if an image record needs reprocessing
   */
  static needsReprocessing(imageRecord: any): boolean {
    if (!imageRecord) return false;
    
    // If it's a legacy image with a valid URL but no artwork_images record
    if (imageRecord.id?.startsWith('legacy-')) {
      return imageRecord.image_url && imageRecord.image_url !== '/placeholder.svg';
    }
    
    // If it has an image_url but no processed versions or storage paths
    return !!(imageRecord.image_url && 
             imageRecord.image_url !== '/placeholder.svg' &&
             imageRecord.image_url !== 'processing' &&
             !imageRecord.processed &&
             !imageRecord.thumbnail_storage_path &&
             !imageRecord.medium_storage_path);
  }
}
