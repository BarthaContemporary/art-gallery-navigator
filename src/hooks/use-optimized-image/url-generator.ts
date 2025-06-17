
import { OptimizedImageConfig, ImageTierType } from "./types";

export const generateImageUrl = (config: OptimizedImageConfig, tier: ImageTierType): string => {
  if (!config.originalUrl || config.originalUrl === "/placeholder.svg") {
    return "/placeholder.svg";
  }

  const sizeConfig = config.sizes[tier];
  
  // Check if it's already a Cloudinary URL - validate it's properly formatted
  if (config.originalUrl.includes('res.cloudinary.com')) {
    // Validate Cloudinary URL structure
    if (config.originalUrl.includes('/image/fetch/') || config.originalUrl.includes('/upload/')) {
      return config.originalUrl;
    }
    // If it's a malformed Cloudinary URL, treat it as original and transform
  }
  
  // For Supabase storage URLs, apply transformations
  if (config.originalUrl.includes('supabase.co/storage') && config.originalUrl.includes('/public/')) {
    const transformParams = `w=${sizeConfig.width}&h=${sizeConfig.height}&resize=contain&q=${sizeConfig.quality}&f=webp`;
    return config.originalUrl.includes('?') 
      ? `${config.originalUrl}&transform=${transformParams}`
      : `${config.originalUrl}?transform=${transformParams}`;
  }
  
  // Return original URL if no transformations can be applied
  return config.originalUrl;
};

export const validateImageUrl = (url: string): boolean => {
  if (!url || url === "/placeholder.svg") return true;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const getImageFallbackChain = (primaryUrl: string | null, fallbackUrl: string | null): string[] => {
  const urls: string[] = [];
  
  if (primaryUrl && validateImageUrl(primaryUrl)) {
    urls.push(primaryUrl);
  }
  
  if (fallbackUrl && validateImageUrl(fallbackUrl) && fallbackUrl !== primaryUrl) {
    urls.push(fallbackUrl);
  }
  
  urls.push("/placeholder.svg");
  
  return urls;
};
