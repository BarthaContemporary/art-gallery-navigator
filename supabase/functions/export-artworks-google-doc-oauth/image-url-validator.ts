
/**
 * Enhanced image URL validation and selection utilities
 */

export interface ImageValidationResult {
  url: string;
  isValid: boolean;
  source: 'cloudinary' | 'supabase_processed' | 'supabase_original' | 'legacy';
  error?: string;
}

export async function validateImageUrl(url: string, timeoutMs: number = 5000): Promise<boolean> {
  if (!url || url === '/placeholder.svg' || url.includes('/processing')) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'GoogleDocsExporter/1.0'
      }
    });

    clearTimeout(timeoutId);
    console.log(`[validateImageUrl] ${url}: ${response.status} ${response.ok ? 'VALID' : 'INVALID'}`);
    
    return response.ok && response.status < 400;
  } catch (error) {
    console.warn(`[validateImageUrl] Failed to validate ${url}:`, error.message);
    return false;
  }
}

export function isCompleteCloudinaryUrl(url: string): boolean {
  return url && 
    url.includes('res.cloudinary.com') && 
    !url.includes('/processing') && 
    !url.includes('%2F') && // Skip URL-encoded paths that are invalid
    (url.startsWith('http://') || url.startsWith('https://'));
}

export function constructSupabaseStorageUrl(storagePath: string, bucket: string): string {
  if (!storagePath) return '';
  
  const cleanPath = storagePath.startsWith('/') ? storagePath.substring(1) : storagePath;
  return `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/${bucket}/${cleanPath}`;
}

export async function findBestImageUrl(imageRecord: any): Promise<ImageValidationResult | null> {
  console.log(`[findBestImageUrl] Processing image record:`, {
    id: imageRecord.id,
    image_url: imageRecord.image_url,
    medium_url: imageRecord.medium_url,
    thumbnail_url: imageRecord.thumbnail_url,
    medium_storage_path: imageRecord.medium_storage_path
  });

  // Use Supabase storage URLs for Google Docs compatibility
  const storagePaths = [
    imageRecord.medium_storage_path,
    imageRecord.large_storage_path,
    imageRecord.thumbnail_storage_path
  ].filter(Boolean);

  for (const path of storagePaths) {
    const url = constructSupabaseStorageUrl(path, 'artwork-images-processed');
    if (await validateImageUrl(url)) {
      console.log(`[findBestImageUrl] Using valid storage URL: ${url}`);
      return { url, isValid: true, source: 'supabase_processed' };
    }
  }

  // Try original bucket as fallback
  for (const path of storagePaths) {
    const url = constructSupabaseStorageUrl(path, 'artwork-images-original');
    if (await validateImageUrl(url)) {
      console.log(`[findBestImageUrl] Using original storage URL: ${url}`);
      return { url, isValid: true, source: 'supabase_original' };
    }
  }

  console.warn(`[findBestImageUrl] No valid image URL found for Google Docs export, image record:`, imageRecord.id);
  return null;
}
