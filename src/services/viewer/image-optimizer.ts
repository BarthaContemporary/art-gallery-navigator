/**
 * Viewer Image Optimizer Service
 * Currently using original URLs directly.
 * To enable Supabase transformations, ensure Pro plan is active and 
 * Image Transformations are enabled in Supabase Storage settings.
 */

import type { ViewerArtworkImage } from '@/types/viewer';

export type ImageTier = 'thumbnail' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'original';

export class ViewerImageOptimizer {
  /**
   * Get optimized image URL for a specific tier
   * Currently returns original URL - transformations disabled
   */
  static getOptimizedUrl(image: ViewerArtworkImage | null, tier: ImageTier): string {
    if (!image) return '/placeholder.svg';
    return image.original_url || '/placeholder.svg';
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
   * Get blur placeholder URL - returns original for now
   */
  static getBlurPlaceholderUrl(image: ViewerArtworkImage | null): string {
    if (!image) return '/placeholder.svg';
    return image.original_url || '/placeholder.svg';
  }

  /**
   * Generate srcset for responsive images - disabled for now
   */
  static generateSrcSet(image: ViewerArtworkImage | null): string | undefined {
    return undefined;
  }
}
