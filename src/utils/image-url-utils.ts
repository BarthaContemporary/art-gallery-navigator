
/**
 * Utility functions for handling image URLs and extracting original URLs from Cloudinary
 */

export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com');
}

export function isSupabaseUrl(url: string): boolean {
  return url.includes('supabase.co/storage');
}

export function extractOriginalUrlFromCloudinary(cloudinaryUrl: string): string | null {
  try {
    if (!isCloudinaryUrl(cloudinaryUrl)) {
      return null;
    }

    // Handle fetch URLs: https://res.cloudinary.com/cloudname/image/fetch/transformations/originalUrl
    if (cloudinaryUrl.includes('/image/fetch/')) {
      const parts = cloudinaryUrl.split('/image/fetch/');
      if (parts.length === 2) {
        const afterFetch = parts[1];
        // Find the last part that looks like a URL (starts with http)
        const urlMatch = afterFetch.match(/(https?:\/\/[^\/]+.*)/);
        if (urlMatch) {
          return decodeURIComponent(urlMatch[1]);
        }
      }
    }

    // Handle upload URLs with transformations
    if (cloudinaryUrl.includes('/image/upload/')) {
      // For upload URLs, we can't extract the original URL easily
      // So we return null to indicate this URL should be skipped
      return null;
    }

    return null;
  } catch (error) {
    console.warn('Failed to extract original URL from Cloudinary:', cloudinaryUrl, error);
    return null;
  }
}

export function validateImageUrl(url: string): boolean {
  if (!url || url === "/placeholder.svg" || url.trim() === "") {
    return false;
  }

  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || urlObj.protocol === 'data:';
  } catch {
    return false;
  }
}

export function getPriorityOrderedUrls(imageRecord: any): string[] {
  const urls: string[] = [];
  
  if (!imageRecord) return urls;

  // Priority 1: Direct Supabase URLs (most reliable)
  if (imageRecord.image_url && isSupabaseUrl(imageRecord.image_url)) {
    urls.push(imageRecord.image_url);
  }
  if (imageRecord.medium_url && isSupabaseUrl(imageRecord.medium_url)) {
    urls.push(imageRecord.medium_url);
  }
  if (imageRecord.thumbnail_url && isSupabaseUrl(imageRecord.thumbnail_url)) {
    urls.push(imageRecord.thumbnail_url);
  }

  // Priority 2: Extract original URLs from Cloudinary URLs
  const cloudinaryUrls = [
    imageRecord.image_url,
    imageRecord.medium_url, 
    imageRecord.thumbnail_url
  ].filter(url => url && isCloudinaryUrl(url));

  for (const cloudinaryUrl of cloudinaryUrls) {
    const originalUrl = extractOriginalUrlFromCloudinary(cloudinaryUrl);
    if (originalUrl && validateImageUrl(originalUrl) && !urls.includes(originalUrl)) {
      urls.push(originalUrl);
    }
  }

  // Priority 3: Valid Cloudinary URLs (as last resort)
  const validCloudinaryUrls = cloudinaryUrls.filter(url => 
    validateImageUrl(url) && !urls.some(existingUrl => 
      extractOriginalUrlFromCloudinary(url) === existingUrl
    )
  );
  urls.push(...validCloudinaryUrls);

  // Filter out invalid URLs and duplicates
  return urls.filter((url, index, array) => 
    validateImageUrl(url) && array.indexOf(url) === index
  );
}
