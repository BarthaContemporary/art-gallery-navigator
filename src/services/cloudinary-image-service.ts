
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface CloudinaryImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'limit' | 'scale';
}

interface ImageProcessingStatus {
  isProcessed: boolean;
  needsProcessing: boolean;
  processingInProgress: boolean;
}

export class CloudinaryImageService {
  private static cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  private static processingQueue = new Set<string>();

  static isCloudinaryConfigured(): boolean {
    return !!this.cloudName && this.cloudName !== 'demo';
  }

  static getOptimizedUrl(
    originalUrl: string | null,
    tier: 'thumbnail' | 'medium' | 'full',
    options: CloudinaryImageOptions = {}
  ): string {
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
    }

    // If Cloudinary is not configured, return original URL
    if (!this.isCloudinaryConfigured()) {
      logger.warn('Cloudinary not configured, returning original URL');
      return originalUrl;
    }

    // If it's already a Cloudinary URL, return as is
    if (originalUrl.includes('res.cloudinary.com')) {
      return originalUrl;
    }

    // Generate Cloudinary fetch URL with optimizations
    const defaultOptions = this.getDefaultOptionsForTier(tier);
    const mergedOptions = { ...defaultOptions, ...options };
    
    const transformations = this.buildTransformations(mergedOptions);
    return `https://res.cloudinary.com/${this.cloudName}/image/fetch/${transformations}/${encodeURIComponent(originalUrl)}`;
  }

  static getDefaultOptionsForTier(tier: 'thumbnail' | 'medium' | 'full'): CloudinaryImageOptions {
    switch (tier) {
      case 'thumbnail':
        return { width: 400, height: 400, quality: 85, format: 'auto', crop: 'fill' };
      case 'medium':
        return { width: 800, height: 800, quality: 90, format: 'auto', crop: 'limit' };
      case 'full':
        return { width: 1600, height: 1600, quality: 95, format: 'auto', crop: 'limit' };
    }
  }

  static buildTransformations(options: CloudinaryImageOptions): string {
    const transforms = [];
    
    if (options.width) transforms.push(`w_${options.width}`);
    if (options.height) transforms.push(`h_${options.height}`);
    if (options.quality) transforms.push(`q_${options.quality}`);
    if (options.format) transforms.push(`f_${options.format}`);
    if (options.crop) transforms.push(`c_${options.crop}`);
    
    // Add auto optimizations
    transforms.push('fl_progressive', 'fl_immutable_cache');
    
    return transforms.join(',');
  }

  static analyzeProcessingStatus(imageRecord: any): ImageProcessingStatus {
    if (!imageRecord) {
      return {
        isProcessed: false,
        needsProcessing: false,
        processingInProgress: false
      };
    }

    const hasCloudinaryUrls = imageRecord?.thumbnail_url || imageRecord?.medium_url;
    const hasProcessedFlag = imageRecord?.processed === true;
    
    return {
      isProcessed: hasProcessedFlag && hasCloudinaryUrls,
      needsProcessing: !hasProcessedFlag && !!imageRecord.image_url,
      processingInProgress: this.processingQueue.has(imageRecord?.id)
    };
  }

  static async triggerProcessing(imageRecord: any): Promise<boolean> {
    if (!imageRecord?.id || this.processingQueue.has(imageRecord.id)) {
      return false;
    }

    this.processingQueue.add(imageRecord.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
        body: { 
          image_url: imageRecord.image_url, 
          artwork_image_id: imageRecord.id 
        }
      });

      if (error) throw error;
      
      logger.log(`Successfully triggered Cloudinary processing for image ${imageRecord.id}`);
      return true;
    } catch (error) {
      logger.error(`Failed to trigger Cloudinary processing for image ${imageRecord.id}:`, error);
      return false;
    } finally {
      this.processingQueue.delete(imageRecord.id);
    }
  }

  static getBestAvailableUrl(
    imageRecord: any, 
    tier: 'thumbnail' | 'medium' | 'full'
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
      if (this.isCloudinaryConfigured()) {
        return this.getOptimizedUrl(imageRecord.image_url, tier);
      }
      // Otherwise return the original URL
      return imageRecord.image_url;
    }

    // Fallback to placeholder
    return '/placeholder.svg';
  }

  /**
   * Get optimized storage URL from the processed images bucket
   */
  static getOptimizedStorageUrl(
    imageRecord: any,
    tier: 'thumbnail' | 'medium' | 'full'
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

    // Generate Supabase storage URL for the processed image
    const { data } = supabase.storage
      .from('artwork-images-processed')
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  /**
   * Get the best available image URL with fallback hierarchy
   */
  static getBestImageUrl(
    imageRecord: any,
    tier: 'thumbnail' | 'medium' | 'full'
  ): string {
    if (!imageRecord) return '/placeholder.svg';

    // 1. Try optimized storage URLs first (from processed bucket)
    const optimizedStorageUrl = this.getOptimizedStorageUrl(imageRecord, tier);
    if (optimizedStorageUrl) {
      return optimizedStorageUrl;
    }

    // 2. Try Cloudinary URLs from database
    if (imageRecord.processed) {
      const cloudinaryUrl = this.getBestAvailableUrl(imageRecord, tier);
      if (cloudinaryUrl !== '/placeholder.svg') {
        return cloudinaryUrl;
      }
    }

    // 3. Fallback to original image with Cloudinary optimization
    if (imageRecord.image_url && this.isCloudinaryConfigured()) {
      return this.getOptimizedUrl(imageRecord.image_url, tier);
    }

    // 4. Last resort: original image URL
    if (imageRecord.image_url) {
      return imageRecord.image_url;
    }

    return '/placeholder.svg';
  }
}
