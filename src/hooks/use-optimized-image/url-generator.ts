
import { OptimizedImageConfig, ImageTierType } from "./types";

export const generateImageUrl = (config: OptimizedImageConfig, tier: ImageTierType): string => {
  if (!config.originalUrl || config.originalUrl === "/placeholder.svg") {
    return "/placeholder.svg";
  }

  const sizeConfig = config.sizes[tier];
  
  if (config.originalUrl.includes('supabase.co/storage') && config.originalUrl.includes('/public/')) {
    const transformParams = `w=${sizeConfig.width}&h=${sizeConfig.height}&resize=contain&q=${sizeConfig.quality}&f=webp`;
    return config.originalUrl.includes('?') 
      ? `${config.originalUrl}&transform=${transformParams}`
      : `${config.originalUrl}?transform=${transformParams}`;
  }
  
  return config.originalUrl;
};
