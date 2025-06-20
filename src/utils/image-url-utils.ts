
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
        // Find the encoded URL part (everything after the transformations)
        const urlMatch = afterFetch.match(/https?%3A%2F%2F[^?&]+/);
        if (urlMatch) {
          return decodeURIComponent(urlMatch[0]);
        }
        // Also try to find unencoded URLs
        const directUrlMatch = afterFetch.match(/(https?:\/\/[^?&\s]+)/);
        if (directUrlMatch) {
          return directUrlMatch[1];
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

  console.log(`[getPriorityOrderedUrls] Processing image record:`, {
    image_url: imageRecord.image_url,
    medium_url: imageRecord.medium_url,
    thumbnail_url: imageRecord.thumbnail_url
  });

  // Collect all available URLs
  const allUrls = [
    imageRecord.image_url,
    imageRecord.medium_url, 
    imageRecord.thumbnail_url
  ].filter(url => url && validateImageUrl(url));

  // Priority 1: Direct Supabase URLs (most reliable)
  const directSupabaseUrls = allUrls.filter(url => isSupabaseUrl(url));
  urls.push(...directSupabaseUrls);
  console.log(`[getPriorityOrderedUrls] Found ${directSupabaseUrls.length} direct Supabase URLs:`, directSupabaseUrls);

  // Priority 2: Extract original URLs from Cloudinary URLs
  const cloudinaryUrls = allUrls.filter(url => isCloudinaryUrl(url));
  for (const cloudinaryUrl of cloudinaryUrls) {
    const originalUrl = extractOriginalUrlFromCloudinary(cloudinaryUrl);
    if (originalUrl && validateImageUrl(originalUrl) && !urls.includes(originalUrl)) {
      console.log(`[getPriorityOrderedUrls] Extracted original URL from Cloudinary: ${originalUrl}`);
      urls.push(originalUrl);
    }
  }

  // Priority 3: Valid non-Cloudinary URLs that aren't already included
  const otherValidUrls = allUrls.filter(url => 
    !isCloudinaryUrl(url) && 
    !isSupabaseUrl(url) && 
    !urls.includes(url)
  );
  urls.push(...otherValidUrls);

  // Filter out duplicates and invalid URLs
  const finalUrls = urls.filter((url, index, array) => 
    validateImageUrl(url) && array.indexOf(url) === index
  );

  console.log(`[getPriorityOrderedUrls] Final prioritized URLs:`, finalUrls);
  return finalUrls;
}
