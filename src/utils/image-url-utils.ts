
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
    imageRecord.medium_url,    // Priority 1: Medium optimized images
    imageRecord.thumbnail_url, // Priority 2: Thumbnail optimized images  
    imageRecord.image_url      // Priority 3: Original/full images
  ].filter(url => url && validateImageUrl(url));

  // Priority 1: Valid Cloudinary URLs (optimized)
  const cloudinaryUrls = allUrls.filter(url => isCloudinaryUrl(url));
  urls.push(...cloudinaryUrls);
  console.log(`[getPriorityOrderedUrls] Found ${cloudinaryUrls.length} Cloudinary URLs:`, cloudinaryUrls);

  // Priority 2: Direct Supabase URLs
  const directSupabaseUrls = allUrls.filter(url => 
    isSupabaseUrl(url) && !urls.includes(url)
  );
  urls.push(...directSupabaseUrls);
  console.log(`[getPriorityOrderedUrls] Found ${directSupabaseUrls.length} direct Supabase URLs:`, directSupabaseUrls);

  // Priority 3: Other valid URLs not already included
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
