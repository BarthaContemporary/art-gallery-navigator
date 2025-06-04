
import { logger } from "@/lib/logger";

export const createBlurPlaceholder = async (imageUrl: string): Promise<string> => {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    return new Promise<string>((resolve) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        canvas.width = 20;
        canvas.height = 15;
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, 20, 15);
          const blurUrl = canvas.toDataURL("image/jpeg", 0.1);
          resolve(blurUrl);
        } else {
          resolve("");
        }
      };
      
      img.onerror = () => resolve("");
      img.src = imageUrl;
    });
  } catch (error) {
    logger.error("Failed to create blur placeholder:", error);
    return "";
  }
};
