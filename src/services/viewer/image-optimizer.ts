/**
 * Viewer Image Optimizer Service
 * Uses Cloudinary for on-the-fly image optimization
 */

import type { ViewerArtworkImage } from '@/types/viewer';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';

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
  private static isConfigured(): boolean {
    return !!CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME !== 'demo';
  }

  /**
   * Get optimized URL for a given image and tier
   */
  static getOptimizedUrl(image: ViewerArtworkImage | null, tier: ImageTier): string {
    if (!image) return '/placeholder.svg';

    // First, check if we have pre-processed URLs
    const preProcessedUrl = this.getPreProcessedUrl(image, tier);
    if (preProcessedUrl) return preProcessedUrl;

    // Get original URL
    const originalUrl = image.original_url;
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
    }

    // If Cloudinary is not configured, return original
    if (!this.isConfigured()) {
      return originalUrl;
    }

    // If it's already a Cloudinary URL, return as-is for now
    if (originalUrl.includes('res.cloudinary.com')) {
      return originalUrl;
    }

    // Generate Cloudinary fetch URL with optimizations
    const config = TIER_CONFIGS[tier];
    const transforms = [
      `w_${config.width}`,
      `q_${config.quality}`,
      'f_auto',
      'c_limit',
      'fl_progressive',
    ].join(',');

    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transforms}/${encodeURIComponent(originalUrl)}`;
  }

  /**
   * Get pre-processed URL if available
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

    const originalUrl = image.original_url;
    if (!originalUrl || !this.isConfigured()) {
      return '/placeholder.svg';
    }

    // Already Cloudinary URL
    if (originalUrl.includes('res.cloudinary.com')) {
      return originalUrl;
    }

    // Generate tiny blur placeholder via Cloudinary
    const transforms = [
      'w_40',
      'q_30',
      'f_auto',
      'e_blur:800',
    ].join(',');

    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transforms}/${encodeURIComponent(originalUrl)}`;
  }
}
