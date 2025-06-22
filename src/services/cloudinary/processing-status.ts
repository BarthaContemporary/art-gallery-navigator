
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ImageProcessingStatus } from "./types";

export class CloudinaryProcessingStatus {
  private static processingQueue: Set<string> = new Set<string>();

  static analyzeProcessingStatus(imageRecord: any): ImageProcessingStatus {
    if (!imageRecord) {
      return {
        isProcessed: false,
        needsProcessing: false,
        processingInProgress: false
      };
    }

    const hasCloudinaryUrls = imageRecord?.thumbnail_url || imageRecord?.medium_url;
    const hasProcessedFlag = imageRecord?.processed === true;
    
    return {
      isProcessed: hasProcessedFlag && hasCloudinaryUrls,
      needsProcessing: !hasProcessedFlag && !!imageRecord.image_url,
      processingInProgress: CloudinaryProcessingStatus.processingQueue.has(imageRecord?.id)
    };
  }

  static async triggerProcessing(imageRecord: any): Promise<boolean> {
    if (!imageRecord?.id || CloudinaryProcessingStatus.processingQueue.has(imageRecord.id)) {
      return false;
    }

    CloudinaryProcessingStatus.processingQueue.add(imageRecord.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
        body: { 
          image_url: imageRecord.image_url, 
          artwork_image_id: imageRecord.id 
        }
      });

      if (error) throw error;
      
      logger.log(`Successfully triggered Cloudinary processing for image ${imageRecord.id}`);
      return true;
    } catch (error) {
      logger.error(`Failed to trigger Cloudinary processing for image ${imageRecord.id}:`, error);
      return false;
    } finally {
      CloudinaryProcessingStatus.processingQueue.delete(imageRecord.id);
    }
  }
}
