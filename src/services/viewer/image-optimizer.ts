/**
 * Viewer Image Optimizer Service
 * 
 * Image transformations are currently DISABLED because the Supabase
 * transformation endpoint is not working as expected.
 * 
 * To re-enable: Set USE_TRANSFORMATIONS = true once you've verified
 * transformations work in your Supabase dashboard.
 */

import type { ViewerArtworkImage } from '@/types/viewer';

export type ImageTier = 'thumbnail' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'original';

// Toggle this to enable/disable transformations
const USE_TRANSFORMATIONS = false;

interface TierConfig {
  width: number;
  quality: number;
}

const TIER_CONFIGS: Record<ImageTier, TierConfig> = {
  thumbnail: { width: 150, quality: 60 },
  small: { width: 400, quality: 70 },
  medium: { width: 1200, quality: 80 },
  large: { width: 2400, quality: 85 },
  xlarge: { width: 2500, quality: 90 },
  xxlarge: { width: 2500, quality: 95 },
  original: { width: 0, quality: 100 },
};

export class ViewerImageOptimizer {
  /**
   * Transform Supabase storage URL to use image transformations
   */
  private static getTransformedUrl(
    originalUrl: string,
    width: number,
    quality: number
  ): string {
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
    }

    // If transformations disabled or requesting original, return as-is
    if (!USE_TRANSFORMATIONS || width === 0) {
      return originalUrl;
    }

    try {
      const url = new URL(originalUrl);
      
      if (!url.pathname.includes('/storage/v1/object/public/')) {
        return originalUrl;
      }

      const transformedPath = url.pathname.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/'
      );

      return `${url.origin}${transformedPath}?width=${width}&quality=${quality}&resize=contain`;
    } catch (error) {
      return originalUrl;
    }
  }

  /**
   * Get optimized image URL for a specific tier
   * Currently returns original URL (transformations disabled)
   */
  static getOptimizedUrl(image: ViewerArtworkImage | null, tier: ImageTier): string {
    if (!image) return '/placeholder.svg';
    
    const config = TIER_CONFIGS[tier];
    const sourceUrl = image.original_url || '/placeholder.svg';
    
    return this.getTransformedUrl(sourceUrl, config.width, config.quality);
  }

  /**
   * Get the best available URL (original)
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
   * Get blur placeholder URL
   */
  static getBlurPlaceholderUrl(image: ViewerArtworkImage | null): string {
    if (!image) return '/placeholder.svg';
    // When transformations disabled, just return original
    return image.original_url || '/placeholder.svg';
  }

  /**
   * Generate srcset for responsive images
   */
  static generateSrcSet(image: ViewerArtworkImage | null): string | undefined {
    if (!USE_TRANSFORMATIONS || !image?.original_url) return undefined;
    
    const widths = [400, 800, 1200, 1600, 2400];
    const srcset = widths
      .map(w => `${this.getTransformedUrl(image.original_url, w, 80)} ${w}w`)
      .join(', ');
    
    return srcset;
  }
}
