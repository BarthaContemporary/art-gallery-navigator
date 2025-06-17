
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function useImageDiagnostics() {
  const diagnoseImageUrls = useCallback(async () => {
    try {
      logger.log('Starting image URL diagnostics...');
      
      // Fetch all artwork images to check their URL status
      const { data: images, error } = await supabase
        .from('artwork_images')
        .select('id, image_url, thumbnail_url, medium_url, processed')
        .limit(50); // Limit to prevent overwhelming

      if (error) throw error;

      const issues = {
        missingCloudinary: 0,
        brokenUrls: 0,
        unprocessed: 0,
        malformed: 0
      };

      const problemImages: string[] = [];

      for (const image of images || []) {
        // Check if image should have Cloudinary URLs but doesn't
        if (image.processed && (!image.thumbnail_url || !image.medium_url)) {
          issues.missingCloudinary++;
          problemImages.push(image.id);
        }

        // Check if marked as unprocessed
        if (!image.processed) {
          issues.unprocessed++;
        }

        // Check for malformed Cloudinary URLs
        if (image.thumbnail_url?.includes('res.cloudinary.com') && 
            !image.thumbnail_url.includes('/image/fetch/') && 
            !image.thumbnail_url.includes('/upload/')) {
          issues.malformed++;
          problemImages.push(image.id);
        }
      }

      logger.log('Image diagnostics complete:', issues);
      
      toast.info('Image Diagnostics Complete', {
        description: `Found ${issues.missingCloudinary} missing Cloudinary URLs, ${issues.unprocessed} unprocessed images, ${issues.malformed} malformed URLs`
      });

      return { issues, problemImages, totalChecked: images?.length || 0 };

    } catch (error) {
      logger.error('Image diagnostics failed:', error);
      toast.error('Diagnostics failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }, []);

  const triggerBatchProcessing = useCallback(async (limit: number = 10) => {
    try {
      logger.log(`Triggering batch processing for ${limit} images...`);
      
      const { data, error } = await supabase.functions.invoke('batch-process-unprocessed-images', {
        body: { limit }
      });

      if (error) throw error;

      logger.log('Batch processing result:', data);
      
      toast.success('Batch Processing Started', {
        description: `Processing ${data.attemptedCount || limit} images`
      });

      return data;

    } catch (error) {
      logger.error('Batch processing failed:', error);
      toast.error('Batch processing failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }, []);

  return {
    diagnoseImageUrls,
    triggerBatchProcessing
  };
}
