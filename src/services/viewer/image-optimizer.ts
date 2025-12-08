/**
 * Viewer Image Optimizer Service
 * Uses Supabase Storage image transformations (requires Pro plan)
 * URL format: /storage/v1/render/image/public/{bucket}/{path}?width=X&quality=Y
 * Note: Supabase has a 50MB file size limit for transformations
 */

import type { ViewerArtworkImage } from '@/types/viewer';

export type ImageTier = 'thumbnail' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'original';

// Supabase transformation limit is 50MB
const MAX_TRANSFORMABLE_SIZE_BYTES = 50 * 1024 * 1024;

interface TierConfig {
  width: number;
  quality: number;
}

const TIER_CONFIGS: Record<ImageTier, TierConfig> = {
  thumbnail: { width: 150, quality: 60 },
  small: { width: 400, quality: 70 },
  medium: { width: 1200, quality: 80 },
  large: { width: 2400, quality: 85 },
  xlarge: { width: 4800, quality: 90 },
  xxlarge: { width: 9600, quality: 95 },
  original: { width: 0, quality: 100 }, // 0 = no transformation
};

export class ViewerImageOptimizer {
  /**
   * Transform Supabase storage URL to use image transformations
   * From: /storage/v1/object/public/bucket/path
   * To: /storage/v1/render/image/public/bucket/path?width=X&quality=Y
   * Falls back to original URL if file exceeds 50MB limit
   */
  private static getTransformedUrl(
    originalUrl: string,
    width: number,
    quality: number,
    fileSize?: number | null
  ): string {
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
    }

    // Skip transformation for original tier (width = 0)
    if (width === 0) return originalUrl;

    // Skip transformation if file exceeds Supabase's 50MB limit
    if (fileSize && fileSize > MAX_TRANSFORMABLE_SIZE_BYTES) {
      console.warn(`Image exceeds 50MB limit (${(fileSize / 1024 / 1024).toFixed(1)}MB), using original URL`);
      return originalUrl;
    }

    try {
      const url = new URL(originalUrl);
      
      // Check if it's a Supabase storage URL with the object path
      if (!url.pathname.includes('/storage/v1/object/public/')) {
        return originalUrl;
      }

      // Replace /object/ with /render/image/ for transformations
      const transformedPath = url.pathname.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/'
      );

      // Build transformation URL with query parameters
      return `${url.origin}${transformedPath}?width=${width}&quality=${quality}`;
    } catch (error) {
      console.warn('Failed to transform image URL:', error);
      return originalUrl;
    }
  }

  /**
   * Get optimized image URL for a specific tier
   */
  static getOptimizedUrl(image: ViewerArtworkImage | null, tier: ImageTier): string {
    if (!image) return '/placeholder.svg';
    
    const config = TIER_CONFIGS[tier];
    const sourceUrl = image.original_url || '/placeholder.svg';
    
    return this.getTransformedUrl(sourceUrl, config.width, config.quality, image.file_size);
  }

  /**
   * Get the best available URL (original/largest)
   */
  static getBestAvailableUrl(image: ViewerArtworkImage | null): string {
    if (!image) return '/placeholder.svg';
    return image.original_url || '/placeholder.svg';
  }

  /**
   * Preload an image and return a promise
   */
  static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!url || url === '/placeholder.svg') {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }

  /**
   * Get tiny blur placeholder URL for instant display
   */
  static getBlurPlaceholderUrl(image: ViewerArtworkImage | null): string {
    if (!image) return '/placeholder.svg';
    const sourceUrl = image.original_url || '/placeholder.svg';
    // Ultra-small for blur placeholder (loads instantly)
    return this.getTransformedUrl(sourceUrl, 40, 30, image.file_size);
  }

  /**
   * Generate srcset for responsive images
   */
  static generateSrcSet(image: ViewerArtworkImage | null): string | undefined {
    if (!image?.original_url) return undefined;
    
    // Skip srcset for files exceeding 50MB limit
    if (image.file_size && image.file_size > MAX_TRANSFORMABLE_SIZE_BYTES) {
      return undefined;
    }
    
    const widths = [400, 800, 1200, 1600, 2400];
    const srcset = widths
      .map(w => `${this.getTransformedUrl(image.original_url, w, 80, image.file_size)} ${w}w`)
      .join(', ');
    
    return srcset;
  }
}