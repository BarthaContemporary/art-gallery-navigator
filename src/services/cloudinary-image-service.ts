
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
  private static cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
  private static processingQueue = new Set<string>();

  static getOptimizedUrl(
    originalUrl: string | null,
    tier: 'thumbnail' | 'medium' | 'full',
    options: CloudinaryImageOptions = {}
  ): string {
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
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
        return { width: 1200, height: 1200, quality: 90, format: 'auto', crop: 'limit' };
      case 'full':
        return { width: 2400, height: 2400, quality: 95, format: 'auto', crop: 'limit' };
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
    const hasCloudinaryUrls = imageRecord?.thumbnail_url || imageRecord?.medium_url;
    const hasProcessedFlag = imageRecord?.processed === true;
    
    return {
      isProcessed: hasProcessedFlag && hasCloudinaryUrls,
      needsProcessing: !hasProcessedFlag || !hasCloudinaryUrls,
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

    const status = this.analyzeProcessingStatus(imageRecord);
    
    if (status.isProcessed) {
      // Use Cloudinary URLs if available
      switch (tier) {
        case 'thumbnail':
          return imageRecord.thumbnail_url || this.getOptimizedUrl(imageRecord.image_url, tier);
        case 'medium':
          return imageRecord.medium_url || this.getOptimizedUrl(imageRecord.image_url, tier);
        case 'full':
          return imageRecord.image_url || this.getOptimizedUrl(imageRecord.image_url, tier);
      }
    }

    // Fallback to original or optimized fetch URL
    return imageRecord.image_url || '/placeholder.svg';
  }
}
