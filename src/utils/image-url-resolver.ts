
import { logger } from "@/lib/logger";

export interface ImageRecord {
  id: string;
  image_url: string;
  thumbnail_url?: string | null;
  medium_url?: string | null;
  processed?: boolean;
}

export interface UrlValidationResult {
  isValid: boolean;
  url: string;
  error?: string;
}

export class ImageUrlResolver {
  private static urlCache = new Map<string, boolean>();
  private static validationPromises = new Map<string, Promise<boolean>>();

  /**
   * Validates if a URL is accessible and returns an image
   */
  static async validateImageUrl(url: string): Promise<boolean> {
    if (!url || url === '/placeholder.svg') {
      return false;
    }

    // Check cache first
    if (this.urlCache.has(url)) {
      return this.urlCache.get(url)!;
    }

    // Check if validation is already in progress
    if (this.validationPromises.has(url)) {
      return this.validationPromises.get(url)!;
    }

    // Start validation
    const validationPromise = this.performUrlValidation(url);
    this.validationPromises.set(url, validationPromise);

    try {
      const isValid = await validationPromise;
      this.urlCache.set(url, isValid);
      return isValid;
    } finally {
      this.validationPromises.delete(url);
    }
  }

  private static async performUrlValidation(url: string): Promise<boolean> {
    try {
      // Basic URL format validation
      new URL(url);

      // For Cloudinary URLs, do a quick HEAD request
      if (url.includes('res.cloudinary.com')) {
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        return response.ok;
      }

      // For Supabase URLs, assume they're valid if properly formatted
      if (url.includes('supabase.co/storage')) {
        return true;
      }

      // For other URLs, do a quick HEAD request
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (error) {
      logger.warn(`[ImageUrlResolver] URL validation failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Gets the best available URL for an image with proper validation
   */
  static async getBestValidUrl(
    imageRecord: ImageRecord | null | undefined,
    preferredSize: 'thumbnail' | 'medium' | 'full' = 'medium'
  ): Promise<string> {
    if (!imageRecord) {
      return '/placeholder.svg';
    }

    logger.log(`[ImageUrlResolver] Resolving URL for image ${imageRecord.id}, preferred size: ${preferredSize}`);

    // Build priority list based on preferred size
    const urlCandidates: string[] = [];

    // Add size-specific URLs first
    if (preferredSize === 'thumbnail' && imageRecord.thumbnail_url) {
      urlCandidates.push(imageRecord.thumbnail_url);
    }
    if (preferredSize === 'medium' && imageRecord.medium_url) {
      urlCandidates.push(imageRecord.medium_url);
    }

    // Always add the original image URL as high priority
    if (imageRecord.image_url) {
      urlCandidates.push(imageRecord.image_url);
    }

    // Add other processed URLs as fallbacks
    if (imageRecord.medium_url && !urlCandidates.includes(imageRecord.medium_url)) {
      urlCandidates.push(imageRecord.medium_url);
    }
    if (imageRecord.thumbnail_url && !urlCandidates.includes(imageRecord.thumbnail_url)) {
      urlCandidates.push(imageRecord.thumbnail_url);
    }

    logger.log(`[ImageUrlResolver] URL candidates:`, urlCandidates);

    // Test each URL in priority order
    for (const url of urlCandidates) {
      if (await this.validateImageUrl(url)) {
        logger.log(`[ImageUrlResolver] Using validated URL: ${url}`);
        return url;
      }
    }

    logger.warn(`[ImageUrlResolver] No valid URLs found for image ${imageRecord.id}, using placeholder`);
    return '/placeholder.svg';
  }

  /**
   * Preloads an image URL to check if it's accessible
   */
  static preloadImage(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (url === '/placeholder.svg') {
        resolve(true);
        return;
      }

      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  /**
   * Clears the URL validation cache
   */
  static clearCache(): void {
    this.urlCache.clear();
    this.validationPromises.clear();
  }
}
