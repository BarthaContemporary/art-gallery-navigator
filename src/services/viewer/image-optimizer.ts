/**
 * Viewer Image Optimizer Service
 * Uses Supabase Storage image transformations for on-the-fly resizing
 */

import type { ViewerArtworkImage } from '@/types/viewer';

export type ImageTier = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

interface TierConfig {
  width: number;
  quality: number;
}

const TIER_CONFIGS: Record<ImageTier, TierConfig> = {
  thumbnail: { width: 150, quality: 60 },
  small: { width: 400, quality: 70 },
  medium: { width: 1200, quality: 80 },
  large: { width: 2400, quality: 85 },
  original: { width: 0, quality: 100 }, // 0 = no resize
};

export class ViewerImageOptimizer {
  /**
   * Transform Supabase storage URL to use image transformations
   * Supabase format: /storage/v1/object/public/bucket/path
   * Transform format: /storage/v1/render/image/public/bucket/path?width=X&quality=Y
   */
  private static getTransformedUrl(
    originalUrl: string,
    width: number,
    quality: number
  ): string {
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
    }

    // Skip transformation for original tier
    if (width === 0) return originalUrl;

    try {
      const url = new URL(originalUrl);
      
      // Check if it's a Supabase storage URL
      if (!url.pathname.includes('/storage/v1/object/')) {
        return originalUrl;
      }

      // Convert object URL to render URL for transformations
      // From: /storage/v1/object/public/bucket/path
      // To: /storage/v1/render/image/public/bucket/path
      const transformedPath = url.pathname.replace(
        '/storage/v1/object/',
        '/storage/v1/render/image/'
      );

      // Add transformation parameters
      const params = new URLSearchParams();
      params.set('width', width.toString());
      params.set('quality', quality.toString());
      params.set('format', 'origin'); // Keep original format, or use 'webp' for smaller size

      return `${url.origin}${transformedPath}?${params.toString()}`;
    } catch {
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
    
    return this.getTransformedUrl(sourceUrl, config.width, config.quality);
  }

  /**
   * Get the best available URL (largest)
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
    return this.getTransformedUrl(sourceUrl, 40, 30);
  }

  /**
   * Generate srcset for responsive images
   */
  static generateSrcSet(image: ViewerArtworkImage | null): string | undefined {
    if (!image) return undefined;
    
    const widths = [400, 800, 1200, 1600, 2400];
    const srcset = widths
      .map(w => `${this.getTransformedUrl(image.original_url, w, 80)} ${w}w`)
      .join(', ');
    
    return srcset;
  }
}