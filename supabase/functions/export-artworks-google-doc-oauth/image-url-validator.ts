
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

  // Only use Cloudinary URLs for Google Docs compatibility
  const cloudinaryUrls = [
    imageRecord.medium_url,
    imageRecord.thumbnail_url,
    imageRecord.image_url
  ].filter(url => isCompleteCloudinaryUrl(url));

  for (const url of cloudinaryUrls) {
    if (await validateImageUrl(url)) {
      console.log(`[findBestImageUrl] Using valid Cloudinary URL: ${url}`);
      return { url, isValid: true, source: 'cloudinary' };
    }
  }

  console.warn(`[findBestImageUrl] No valid Cloudinary URL found for Google Docs export, image record:`, imageRecord.id);
  return null;
}
