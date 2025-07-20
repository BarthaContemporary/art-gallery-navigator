
/**
 * Unified Image Service
 * Single source of truth for all image URL resolution and handling
 */

import { supabase } from "@/integrations/supabase/client";
import type { Artwork, ArtworkImage } from "@/types/artwork";

export interface ResolvedImageData {
  url: string;
  source: 'supabase' | 'direct' | 'fallback' | 'placeholder';
  tier: 'thumbnail' | 'medium' | 'large' | 'original';
  width?: number;
  height?: number;
}

export class UnifiedImageService {
  private static cache = new Map<string, ResolvedImageData>();

  /**
   * Resolve the best available image URL for an artwork
   */
  static async resolveImageUrl(
    artwork: Artwork,
    preferredTier: 'thumbnail' | 'medium' | 'large' | 'original' = 'medium'
  ): Promise<ResolvedImageData> {
    const cacheKey = `${artwork.id}-${preferredTier}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await this._resolveImageUrl(artwork, preferredTier);
    
    // Cache the result
    this.cache.set(cacheKey, result);
    
    return result;
  }

  private static async _resolveImageUrl(
    artwork: Artwork,
    preferredTier: 'thumbnail' | 'medium' | 'large' | 'original'
  ): Promise<ResolvedImageData> {
    // Get the primary image or first available image
    const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || 
                        artwork.artwork_images?.[0];

    // Strategy 1: Try Supabase storage URLs first
    if (primaryImage && this._hasValidStoragePaths(primaryImage)) {
      const supabaseUrl = this._getSupabaseStorageUrl(primaryImage, preferredTier);
      if (supabaseUrl && !supabaseUrl.includes('/processing')) {
        return {
          url: supabaseUrl,
          source: 'supabase',
          tier: preferredTier,
          width: this._getExpectedDimension(preferredTier),
          height: this._getExpectedDimension(preferredTier)
        };
      }
    }

    // Strategy 2: Try direct image_url from artwork_images
    if (primaryImage?.image_url && this._isValidImageUrl(primaryImage.image_url)) {
      return {
        url: primaryImage.image_url,
        source: 'direct',
        tier: 'original',
        width: undefined,
        height: undefined
      };
    }

    // Strategy 3: Try artwork's main image_url
    if (artwork.image_url && this._isValidImageUrl(artwork.image_url)) {
      return {
        url: artwork.image_url,
        source: 'fallback',
        tier: 'original',
        width: undefined,
        height: undefined
      };
    }

    // Strategy 4: Placeholder
    return {
      url: '/placeholder.svg',
      source: 'placeholder',
      tier: preferredTier,
      width: this._getExpectedDimension(preferredTier),
      height: this._getExpectedDimension(preferredTier)
    };
  }

  private static _hasValidStoragePaths(image: ArtworkImage): boolean {
    return !!(
      image.thumbnail_storage_path ||
      image.medium_storage_path ||
      image.large_storage_path ||
      image.original_storage_path
    );
  }

  private static _getSupabaseStorageUrl(
    image: ArtworkImage,
    tier: 'thumbnail' | 'medium' | 'large' | 'original'
  ): string | null {
    let storagePath: string | null = null;
    
    switch (tier) {
      case 'thumbnail':
        storagePath = image.thumbnail_storage_path;
        break;
      case 'medium':
        storagePath = image.medium_storage_path;
        break;
      case 'large':
        storagePath = image.large_storage_path;
        break;
      case 'original':
        storagePath = image.original_storage_path;
        break;
    }

    if (!storagePath) {
      return null;
    }

    // Generate the public URL
    const { data } = supabase.storage
      .from('artwork-images')
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  private static _isValidImageUrl(url: string): boolean {
    if (!url || url.trim() === '' || url === 'null' || url === 'undefined') {
      return false;
    }
    
    // Filter out processing URLs
    if (url.includes('/processing')) {
      return false;
    }

    try {
      new URL(url, window.location.origin);
      return true;
    } catch {
      return false;
    }
  }

  private static _getExpectedDimension(tier: 'thumbnail' | 'medium' | 'large' | 'original'): number {
    switch (tier) {
      case 'thumbnail': return 400;
      case 'medium': return 800;
      case 'large': return 1200;
      case 'original': return 1600;
    }
  }

  /**
   * Clear the image cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload an image
   */
  static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  }
}
