
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
    new URL(url, window.location.origin);
    return true;
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

  // Priority: image_url (most reliable) -> medium_url -> thumbnail_url
  const candidates = [
    imageRecord.image_url,
    imageRecord.medium_url,
    imageRecord.thumbnail_url
  ];

  // Add valid URLs in priority order
  for (const url of candidates) {
    if (url && validateImageUrl(url) && !urls.includes(url)) {
      urls.push(url);
    }
  }

  console.log(`[getPriorityOrderedUrls] Final prioritized URLs:`, urls);
  return urls;
}
