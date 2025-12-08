/**
 * Viewer Image Optimizer Service
 * Uses original Supabase storage URLs directly
 * Note: Supabase image transformations require Pro plan
 */

import type { ViewerArtworkImage } from '@/types/viewer';

export type ImageTier = 'thumbnail' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'original';

export class ViewerImageOptimizer {
  /**
   * Get image URL - returns original URL directly
   * All tiers return the same URL since transformations aren't available
   */
  static getOptimizedUrl(image: ViewerArtworkImage | null, _tier: ImageTier): string {
    if (!image) return '/placeholder.svg';
    return image.original_url || '/placeholder.svg';
  }

  /**
   * Get the best available URL
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
   * Get placeholder URL for progressive loading
   */
  static getBlurPlaceholderUrl(image: ViewerArtworkImage | null): string {
    if (!image) return '/placeholder.svg';
    return image.original_url || '/placeholder.svg';
  }

  /**
   * Generate srcset - disabled since we use original URLs
   */
  static generateSrcSet(_image: ViewerArtworkImage | null): string | undefined {
    return undefined;
  }
}