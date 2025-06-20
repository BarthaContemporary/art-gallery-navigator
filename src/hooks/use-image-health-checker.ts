import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { validateImageUrl, isCloudinaryUrl, isSupabaseUrl, extractOriginalUrlFromCloudinary } from '@/utils/image-url-utils';
import { fixCloudinaryUrl, isValidCloudinaryUrl } from './use-optimized-image/url-generator';

interface ImageHealthReport {
  totalImages: number;
  brokenImages: number;
  fixableImages: number;
  cloudinaryImages: number;
  supabaseImages: number;
  placeholderImages: number;
  details: Array<{
    id: string;
    originalUrl: string;
    status: 'valid' | 'broken' | 'fixable' | 'placeholder';
    suggestedFix?: string;
  }>;
}

export function useImageHealthChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const checkImageHealth = useCallback(async (): Promise<ImageHealthReport> => {
    setIsChecking(true);
    logger.log('Starting image health check...');

    try {
      const { data: images, error } = await supabase
        .from('artwork_images')
        .select('id, image_url, thumbnail_url, medium_url, processed');

      if (error) throw error;

      const report: ImageHealthReport = {
        totalImages: images.length,
        brokenImages: 0,
        fixableImages: 0,
        cloudinaryImages: 0,
        supabaseImages: 0,
        placeholderImages: 0,
        details: []
      };

      for (const image of images) {
        const urls = [image.image_url, image.thumbnail_url, image.medium_url].filter(Boolean);
        
        for (const url of urls) {
          if (!url) continue;

          let status: 'valid' | 'broken' | 'fixable' | 'placeholder' = 'valid';
          let suggestedFix: string | undefined;

          if (url === '/placeholder.svg') {
            status = 'placeholder';
            report.placeholderImages++;
          } else if (isCloudinaryUrl(url)) {
            if (isValidCloudinaryUrl(url)) {
              report.cloudinaryImages++;
            } else {
              const fixedUrl = fixCloudinaryUrl(url);
              if (isValidCloudinaryUrl(fixedUrl)) {
                status = 'fixable';
                suggestedFix = fixedUrl;
                report.fixableImages++;
              } else {
                status = 'broken';
                report.brokenImages++;
              }
            }
          } else if (isSupabaseUrl(url)) {
            report.supabaseImages++;
            // Check if Supabase URL is accessible
            if (!validateImageUrl(url)) {
              status = 'broken';
              report.brokenImages++;
            }
          } else {
            if (!validateImageUrl(url)) {
              status = 'broken';
              report.brokenImages++;
            }
          }

          report.details.push({
            id: image.id,
            originalUrl: url,
            status,
            suggestedFix
          });
        }
      }

      logger.log('Image health check completed:', report);
      return report;

    } catch (error) {
      logger.error('Image health check failed:', error);
      throw error;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const fixBrokenImages = useCallback(async (report: ImageHealthReport) => {
    setIsFixing(true);
    logger.log('Starting image fix process...');

    try {
      let fixedCount = 0;
      const fixableImages = report.details.filter(detail => detail.status === 'fixable');

      for (const imageDetail of fixableImages) {
        if (!imageDetail.suggestedFix) continue;

        try {
          const { error } = await supabase
            .from('artwork_images')
            .update({
              image_url: imageDetail.suggestedFix,
              updated_at: new Date().toISOString()
            })
            .eq('id', imageDetail.id);

          if (error) {
            logger.error(`Failed to fix image ${imageDetail.id}:`, error);
          } else {
            fixedCount++;
            logger.log(`Fixed image ${imageDetail.id}: ${imageDetail.originalUrl} -> ${imageDetail.suggestedFix}`);
          }
        } catch (error) {
          logger.error(`Error fixing image ${imageDetail.id}:`, error);
        }
      }

      toast.success(`Fixed ${fixedCount} broken image URLs`);
      logger.log(`Image fix process completed. Fixed ${fixedCount} images.`);

      return fixedCount;

    } catch (error) {
      logger.error('Image fix process failed:', error);
      toast.error('Failed to fix broken images');
      throw error;
    } finally {
      setIsFixing(false);
    }
  }, []);

  const reprocessUnoptimizedImages = useCallback(async () => {
    try {
      logger.log('Starting reprocessing of unoptimized images...');

      // Find images that need Cloudinary processing
      const { data: unprocessedImages, error } = await supabase
        .from('artwork_images')
        .select('id, image_url')
        .or('processed.eq.false,not.image_url.like.%res.cloudinary.com%')
        .not('image_url', 'eq', '/placeholder.svg');

      if (error) throw error;

      if (!unprocessedImages || unprocessedImages.length === 0) {
        toast.info('All images are already optimized');
        return;
      }

      toast.info(`Found ${unprocessedImages.length} images to reprocess`);

      // Process in batches to avoid overwhelming the system
      const batchSize = 5;
      let processedCount = 0;

      for (let i = 0; i < unprocessedImages.length; i += batchSize) {
        const batch = unprocessedImages.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (image) => {
          try {
            const { error } = await supabase.functions.invoke('process-artwork-image-cloudinary', {
              body: { 
                image_url: image.image_url, 
                artwork_image_id: image.id,
                options: {
                  quality: 90,
                  format: 'webp',
                  sharpen: true,
                  autoOrient: true
                }
              }
            });

            if (error) throw error;
            processedCount++;
            return { success: true, id: image.id };
          } catch (error) {
            logger.error(`Failed to reprocess image ${image.id}:`, error);
            return { success: false, id: image.id, error };
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches
        if (i + batchSize < unprocessedImages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast.success(`Successfully reprocessed ${processedCount} images`);
      logger.log(`Reprocessing completed. Processed ${processedCount} images.`);

    } catch (error) {
      logger.error('Image reprocessing failed:', error);
      toast.error('Failed to reprocess images');
    }
  }, []);

  return {
    checkImageHealth,
    fixBrokenImages,
    reprocessUnoptimizedImages,
    isChecking,
    isFixing
  };
}
