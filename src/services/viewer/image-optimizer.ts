/**
 * Viewer Image Optimizer Service
 * Uses pre-processed Cloudinary URLs stored in the database
 * Falls back to original URLs when pre-processed versions aren't available
 */

import type { ViewerArtworkImage } from '@/types/viewer';

export type ImageTier = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

interface TierConfig {
  width: number;
  quality: number;
}

const TIER_CONFIGS: Record<ImageTier, TierConfig> = {
  thumbnail: { width: 100, quality: 60 },
  small: { width: 400, quality: 75 },
  medium: { width: 1200, quality: 85 },
  large: { width: 2400, quality: 90 },
  original: { width: 4000, quality: 95 },
};

export class ViewerImageOptimizer {
  /**
   * Get optimized URL for a given image and tier
   * Always returns original_url since Cloudinary fetch URLs are failing
   */
  static getOptimizedUrl(image: ViewerArtworkImage | null, tier: ImageTier): string {
    if (!image) return '/placeholder.svg';

    // Use original URL directly - Cloudinary fetch URLs are returning 400 errors
    return image.original_url || '/placeholder.svg';
  }

  /**
   * Get pre-processed URL if available (currently unused due to Cloudinary issues)
   */
  private static getPreProcessedUrl(image: ViewerArtworkImage, tier: ImageTier): string | null {
    switch (tier) {
      case 'thumbnail':
      case 'small':
        return image.small_url || null;
      case 'medium':
        return image.medium_url || image.small_url || null;
      case 'large':
      case 'original':
        return image.large_url || image.medium_url || null;
      default:
        return null;
    }
  }

  /**
   * Get the best available URL with fallback chain
   */
  static getBestAvailableUrl(image: ViewerArtworkImage | null, preferredTier: ImageTier = 'medium'): string {
    if (!image) return '/placeholder.svg';

    // Try pre-processed URLs first (in order of preference)
    const tierPriority: ImageTier[] = ['large', 'medium', 'small', 'original'];
    
    // Adjust priority based on preferred tier
    if (preferredTier === 'thumbnail' || preferredTier === 'small') {
      tierPriority.unshift('small');
    }

    for (const tier of tierPriority) {
      const url = this.getPreProcessedUrl(image, tier);
      if (url) return url;
    }

    // Fallback to original
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
   * Generate a tiny blur placeholder URL for progressive loading
   */
  static getBlurPlaceholderUrl(image: ViewerArtworkImage | null): string {
    if (!image) return '/placeholder.svg';
    // Use original URL since Cloudinary is not working
    return image.original_url || '/placeholder.svg';
  }
}
