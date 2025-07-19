/**
 * Phase 1: Clean Image URL Resolution System
 * 
 * This service prioritizes image sources in order:
 * 1. Direct Supabase storage URLs (fastest, most reliable)
 * 2. Cloudinary optimized URLs (when properly configured)
 * 3. Fallback to artwork.image_url
 * 4. Placeholder as last resort
 */

import { logger } from "@/lib/logger";
import { CloudinaryImageService } from "./cloudinary-image-service";
import { supabase } from "@/integrations/supabase/client";
import type { ArtworkImage, Artwork } from "@/hooks/use-artworks";

export type ImageTier = 'thumbnail' | 'medium' | 'full';

export interface ResolvedImageUrl {
  url: string;
  source: 'supabase' | 'cloudinary' | 'fallback' | 'placeholder';
  tier: ImageTier;
  width?: number;
  height?: number;
}

export class ImageUrlResolver {
  private static cache = new Map<string, ResolvedImageUrl>();

  static async resolveImageUrl(
    artwork: Artwork,
    tier: ImageTier = 'medium',
    preferCloudinary: boolean = false
  ): Promise<ResolvedImageUrl> {
    const cacheKey = `${artwork.id}-${tier}-${preferCloudinary}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const resolved = await this._resolveImageUrl(artwork, tier, preferCloudinary);
    
    // Cache the result
    this.cache.set(cacheKey, resolved);
    
    return resolved;
  }

  private static async _resolveImageUrl(
    artwork: Artwork,
    tier: ImageTier,
    preferCloudinary: boolean
  ): Promise<ResolvedImageUrl> {
    const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || 
                         artwork.artwork_images?.[0];

    // Priority 1: Direct Supabase storage URLs (fastest and most reliable)
    if (primaryImage && !preferCloudinary) {
      const supabaseUrl = this.getSupabaseStorageUrl(primaryImage, tier);
      if (supabaseUrl) {
        // Verify the URL is accessible
        const isAccessible = await this.verifyImageAccessibility(supabaseUrl);
        if (isAccessible) {
          return {
            url: supabaseUrl,
            source: 'supabase',
            tier,
            width: this.getExpectedWidth(tier),
            height: this.getExpectedHeight(tier)
          };
        }
      }
    }

    // Priority 2: Cloudinary optimized URLs (when configured and working)
    if (CloudinaryImageService.isCloudinaryConfigured() && primaryImage?.image_url) {
      try {
        const cloudinaryUrl = CloudinaryImageService.getOptimizedUrl(
          primaryImage.image_url,
          tier
        );
        
        // Only use Cloudinary if it's not a processing URL
        if (cloudinaryUrl && !cloudinaryUrl.includes('processing')) {
          const isAccessible = await this.verifyImageAccessibility(cloudinaryUrl);
          if (isAccessible) {
            return {
              url: cloudinaryUrl,
              source: 'cloudinary',
              tier,
              width: this.getExpectedWidth(tier),
              height: this.getExpectedHeight(tier)
            };
          }
        }
      } catch (error) {
        logger.warn('Cloudinary URL generation failed:', error);
      }
    }

    // Priority 3: Fallback to original image URLs
    const fallbackUrl = this.getFallbackUrl(artwork, primaryImage);
    if (fallbackUrl && !fallbackUrl.includes('processing')) {
      const isAccessible = await this.verifyImageAccessibility(fallbackUrl);
      if (isAccessible) {
        return {
          url: fallbackUrl,
          source: 'fallback',
          tier: 'full',
          width: undefined,
          height: undefined
        };
      }
    }

    // Priority 4: Placeholder as last resort
    return {
      url: '/placeholder.svg',
      source: 'placeholder',
      tier,
      width: this.getExpectedWidth(tier),
      height: this.getExpectedHeight(tier)
    };
  }

  private static getSupabaseStorageUrl(image: ArtworkImage, tier: ImageTier): string | null {
    let storagePath: string | null = null;
    
    switch (tier) {
      case 'thumbnail':
        storagePath = image.thumbnail_storage_path;
        break;
      case 'medium':
        storagePath = image.medium_storage_path;
        break;
      case 'full':
        storagePath = image.original_storage_path || image.large_storage_path;
        break;
    }

    if (!storagePath) {
      return null;
    }

    // For Supabase storage, use the processed storage path directly
    // The bucket is already public, so we just need the relative path
    return storagePath;
  }

  private static getFallbackUrl(artwork: Artwork, primaryImage?: ArtworkImage): string | null {
    // Try primary image's original URL first
    if (primaryImage?.image_url) {
      return primaryImage.image_url;
    }

    // Fall back to artwork's main image URL
    if (artwork.image_url) {
      return artwork.image_url;
    }

    return null;
  }

  private static async verifyImageAccessibility(url: string): Promise<boolean> {
    try {
      // For placeholder.svg, always return true
      if (url === '/placeholder.svg') {
        return true;
      }

      // Quick HEAD request to check if image exists with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.debug(`Image accessibility check failed for ${url}:`, error);
      return false;
    }
  }

  private static getExpectedWidth(tier: ImageTier): number {
    switch (tier) {
      case 'thumbnail': return 400;
      case 'medium': return 800;
      case 'full': return 1600;
    }
  }

  private static getExpectedHeight(tier: ImageTier): number {
    switch (tier) {
      case 'thumbnail': return 400;
      case 'medium': return 800;
      case 'full': return 1600;
    }
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  }
}