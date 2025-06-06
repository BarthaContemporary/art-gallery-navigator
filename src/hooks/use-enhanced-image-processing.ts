
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  watermark?: boolean;
  sharpen?: boolean;
  autoOrient?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  thumbnail_url?: string;
  medium_url?: string;
  processed_url?: string;
  processing_details?: {
    original_size: number;
    formats_created: string[];
    options_applied: ImageProcessingOptions;
  };
  error?: string;
}

export function useEnhancedImageProcessing() {
  const processImageWithCloudinary = useCallback(async (
    imageUrl: string, 
    artworkImageId: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessingResult> => {
    try {
      logger.log('Starting enhanced image processing with Cloudinary:', {
        imageUrl,
        artworkImageId,
        options
      });

      // Set default options optimized for artwork images
      const defaultOptions: ImageProcessingOptions = {
        quality: 90,
        format: 'webp',
        watermark: false,
        sharpen: true,
        autoOrient: true,
        ...options
      };

      const { data, error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
        body: { 
          image_url: imageUrl, 
          artwork_image_id: artworkImageId,
          options: defaultOptions
        }
      });

      if (error) {
        logger.error('Enhanced image processing error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Image processing failed');
      }

      logger.log('Enhanced image processing successful:', data);
      
      toast.success('Image processed successfully with Cloudinary', {
        description: `Created ${data.processing_details?.formats_created?.length || 0} optimized versions`
      });

      return {
        success: true,
        thumbnail_url: data.thumbnail_url,
        medium_url: data.medium_url,
        processed_url: data.processed_url,
        processing_details: data.processing_details
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
      logger.error('Enhanced image processing failed:', error);
      
      toast.error('Image processing failed', {
        description: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }, []);

  const processWithWatermark = useCallback((
    imageUrl: string, 
    artworkImageId: string,
    customOptions: Partial<ImageProcessingOptions> = {}
  ) => {
    return processImageWithCloudinary(imageUrl, artworkImageId, {
      ...customOptions,
      watermark: true,
      quality: 95
    });
  }, [processImageWithCloudinary]);

  const processForGallery = useCallback((
    imageUrl: string, 
    artworkImageId: string
  ) => {
    return processImageWithCloudinary(imageUrl, artworkImageId, {
      quality: 95,
      format: 'webp',
      sharpen: true,
      autoOrient: true,
      watermark: false
    });
  }, [processImageWithCloudinary]);

  const processForArchive = useCallback((
    imageUrl: string, 
    artworkImageId: string
  ) => {
    return processImageWithCloudinary(imageUrl, artworkImageId, {
      quality: 100,
      format: 'png',
      sharpen: false,
      autoOrient: true,
      watermark: true
    });
  }, [processImageWithCloudinary]);

  return {
    processImageWithMagick: processImageWithCloudinary, // Keep the same interface
    processImageWithCloudinary,
    processWithWatermark,
    processForGallery,
    processForArchive
  };
}
