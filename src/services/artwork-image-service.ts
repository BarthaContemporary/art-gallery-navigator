/**
 * Clean Artwork Image Service
 * Single, reliable image resolution system
 */

import { supabase } from "@/integrations/supabase/client";
import type { Artwork, ArtworkImage, ImageTier, ResolvedImage } from "@/types/artwork";

export class ArtworkImageService {
  private static cache = new Map<string, ResolvedImage>();

  /**
   * Resolve the best available image for an artwork
   */
  static async resolveImage(
    artwork: Artwork,
    tier: ImageTier = 'medium'
  ): Promise<ResolvedImage> {
    const cacheKey = `${artwork.id}-${tier}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await this._resolveImageUrl(artwork, tier);
    
    // Cache the result
    this.cache.set(cacheKey, result);
    
    return result;
  }

  private static async _resolveImageUrl(
    artwork: Artwork,
    tier: ImageTier
  ): Promise<ResolvedImage> {
    // Get the primary image or first available image
    const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || 
                        artwork.artwork_images?.[0];

    // Strategy 1: Use processed Supabase storage URLs
    if (primaryImage && primaryImage.processed) {
      const supabaseUrl = this._getSupabaseStorageUrl(primaryImage, tier);
      if (supabaseUrl) {
        return {
          url: supabaseUrl,
          source: 'supabase',
          tier,
          width: this._getExpectedDimension(tier),
          height: this._getExpectedDimension(tier)
        };
      }
    }

    // Strategy 2: Use image_url from the primary image
    if (primaryImage?.image_url) {
      return {
        url: primaryImage.image_url,
        source: 'fallback',
        tier: 'original',
        width: undefined,
        height: undefined
      };
    }

    // Strategy 3: Use artwork's main image_url
    if (artwork.image_url) {
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
      tier,
      width: this._getExpectedDimension(tier),
      height: this._getExpectedDimension(tier)
    };
  }

  private static _getSupabaseStorageUrl(
    image: ArtworkImage,
    tier: ImageTier
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

  private static _getExpectedDimension(tier: ImageTier): number {
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