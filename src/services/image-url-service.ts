
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { LocalImageRecord, ImageSize } from "./local-image-service";

export class ImageUrlService {
  private static cache = new Map<string, string>();

  /**
   * Get the best available image URL from local storage
   */
  static getBestImageUrl(imageRecord: LocalImageRecord, preferredSize: ImageSize = 'medium'): string {
    if (!imageRecord) {
      return '/placeholder.svg';
    }

    // Build priority list based on preferred size
    const urlCandidates: Array<{ path: string | null | undefined; bucket: string }> = [];

    // Add preferred size first
    switch (preferredSize) {
      case 'thumbnail':
        urlCandidates.push({ path: imageRecord.thumbnail_storage_path, bucket: 'artwork-images-processed' });
        break;
      case 'medium':
        urlCandidates.push({ path: imageRecord.medium_storage_path, bucket: 'artwork-images-processed' });
        break;
      case 'large':
        urlCandidates.push({ path: imageRecord.large_storage_path, bucket: 'artwork-images-processed' });
        break;
      case 'original':
        urlCandidates.push({ path: imageRecord.original_storage_path, bucket: 'artwork-images-original' });
        break;
    }

    // Add fallbacks in quality order
    urlCandidates.push(
      { path: imageRecord.large_storage_path, bucket: 'artwork-images-processed' },
      { path: imageRecord.medium_storage_path, bucket: 'artwork-images-processed' },
      { path: imageRecord.thumbnail_storage_path, bucket: 'artwork-images-processed' },
      { path: imageRecord.original_storage_path, bucket: 'artwork-images-original' }
    );

    // Find first valid path and generate public URL
    for (const candidate of urlCandidates) {
      if (candidate.path) {
        const cacheKey = `${candidate.bucket}/${candidate.path}`;
        
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey)!;
        }

        const { data } = supabase.storage.from(candidate.bucket).getPublicUrl(candidate.path);
        if (data?.publicUrl) {
          this.cache.set(cacheKey, data.publicUrl);
          return data.publicUrl;
        }
      }
    }

    logger.warn(`[ImageUrlService] No valid image paths found for image ${imageRecord.id}`);
    return '/placeholder.svg';
  }

  /**
   * Clear the URL cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
