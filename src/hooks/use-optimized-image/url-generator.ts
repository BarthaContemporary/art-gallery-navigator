
import { OptimizedImageConfig, ImageTierType } from "./types";
import { validateImageUrl, isCloudinaryUrl, isSupabaseUrl, extractOriginalUrlFromCloudinary } from "@/utils/image-url-utils";

export const generateImageUrl = (config: OptimizedImageConfig, tier: ImageTierType): string => {
  if (!config.originalUrl || config.originalUrl === "/placeholder.svg") {
    return "/placeholder.svg";
  }

  // If it's a direct Supabase URL, use it as-is (most reliable)
  if (isSupabaseUrl(config.originalUrl)) {
    return config.originalUrl;
  }

  // If it's a Cloudinary URL, try to extract the original URL first
  if (isCloudinaryUrl(config.originalUrl)) {
    const originalUrl = extractOriginalUrlFromCloudinary(config.originalUrl);
    if (originalUrl && validateImageUrl(originalUrl)) {
      return originalUrl;
    }
    // If extraction fails, use the Cloudinary URL as-is
    return config.originalUrl;
  }

  // For other URLs, validate and return
  if (validateImageUrl(config.originalUrl)) {
    return config.originalUrl;
  }

  return "/placeholder.svg";
};

export const fixCloudinaryUrl = (url: string): string => {
  if (!url || !url.includes('res.cloudinary.com')) {
    return url;
  }

  try {
    // Handle malformed Cloudinary URLs
    if (url.includes('/image/fetch/') || url.includes('/upload/')) {
      // Check if URL is properly structured
      const urlParts = url.split('res.cloudinary.com/');
      if (urlParts.length === 2) {
        const [protocol, rest] = urlParts;
        const cloudinaryPart = rest.split('/');
        
        // Ensure proper cloud name and path structure
        if (cloudinaryPart.length >= 3) {
          const cloudName = cloudinaryPart[0];
          const resourceType = cloudinaryPart[1] || 'image';
          const deliveryType = cloudinaryPart[2] || 'upload';
          
          // Reconstruct URL with proper format
          const remainingPath = cloudinaryPart.slice(3).join('/');
          return `${protocol}res.cloudinary.com/${cloudName}/${resourceType}/${deliveryType}/${remainingPath}`;
        }
      }
    }
    
    return url;
  } catch (error) {
    console.warn('Failed to fix Cloudinary URL:', url, error);
    return url;
  }
};

export const isValidCloudinaryUrl = (url: string): boolean => {
  if (!url || !url.includes('res.cloudinary.com')) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Check for proper Cloudinary URL structure
    const pathParts = pathname.split('/').filter(part => part.length > 0);
    
    // Should have at least: cloudName/image/upload/...
    if (pathParts.length < 3) {
      return false;
    }
    
    const [cloudName, resourceType, deliveryType] = pathParts;
    
    // Validate parts
    return cloudName.length > 0 && 
           ['image', 'video', 'raw'].includes(resourceType) &&
           ['upload', 'fetch', 'authenticated'].includes(deliveryType);
  } catch (error) {
    return false;
  }
};

export const shouldConvertToCloudinary = (url: string): boolean => {
  return url.includes('supabase.co/storage') || 
         (url.startsWith('http') && !url.includes('res.cloudinary.com'));
};

export const convertToCloudinaryUrl = (url: string, sizeConfig: any): string => {
  try {
    // Use environment variable for cloud name or fallback
    const cloudName = 'your-cloud-name'; // This should come from environment
    const transformations = [
      `w_${sizeConfig.width}`,
      `h_${sizeConfig.height}`,
      'c_limit',
      `q_${sizeConfig.quality}`,
      'f_auto'
    ].join(',');
    
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformations}/${encodeURIComponent(url)}`;
  } catch (error) {
    console.warn('Failed to convert to Cloudinary URL:', url, error);
    return url;
  }
};

export const getImageFallbackChain = (primaryUrl: string | null, fallbackUrl: string | null): string[] => {
  const urls: string[] = [];
  
  if (primaryUrl && validateImageUrl(primaryUrl)) {
    // Try to fix the URL if it's malformed
    const fixedPrimaryUrl = fixCloudinaryUrl(primaryUrl);
    if (validateImageUrl(fixedPrimaryUrl)) {
      urls.push(fixedPrimaryUrl);
    }
  }
  
  if (fallbackUrl && validateImageUrl(fallbackUrl) && fallbackUrl !== primaryUrl) {
    const fixedFallbackUrl = fixCloudinaryUrl(fallbackUrl);
    if (validateImageUrl(fixedFallbackUrl) && fixedFallbackUrl !== urls[0]) {
      urls.push(fixedFallbackUrl);
    }
  }
  
  urls.push("/placeholder.svg");
  
  return urls;
};

export const getOptimizedImageUrl = (
  originalUrl: string | null,
  tier: 'thumbnail' | 'medium' | 'full' = 'medium'
): string => {
  if (!originalUrl || originalUrl === "/placeholder.svg") {
    return "/placeholder.svg";
  }

  const sizeConfig = {
    thumbnail: { width: 400, height: 300, quality: 80 },
    medium: { width: 800, height: 600, quality: 85 },
    full: { width: 1600, height: 1200, quality: 90 }
  };

  const config: OptimizedImageConfig = {
    originalUrl,
    sizes: {
      thumbnail: sizeConfig.thumbnail,
      medium: sizeConfig.medium,
      full: sizeConfig.full
    }
  };

  return generateImageUrl(config, tier);
};
