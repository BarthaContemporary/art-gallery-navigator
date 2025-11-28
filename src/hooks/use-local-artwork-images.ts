
import { useState, useEffect, useCallback } from "react";
import { LocalImageService, type LocalImageRecord } from "@/services/local-image-service";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useLocalArtworkImages(artworkId: string) {
  const [images, setImages] = useState<LocalImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacyImageUrl, setLegacyImageUrl] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  });

  // Fetch images and legacy fallback
  const fetchImages = useCallback(async () => {
    if (!artworkId) {
      setImages([]);
      setLegacyImageUrl(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      logger.log(`[useLocalArtworkImages] Fetching images for artwork: ${artworkId}`);
      
      // Use allSettled for resilience
      const results = await Promise.allSettled([
        LocalImageService.getArtworkImages(artworkId),
        LocalImageService.getProcessingStatus(artworkId)
      ]);
      
      const imageData = results[0].status === 'fulfilled' ? results[0].value : [];
      const statusData = results[1].status === 'fulfilled' ? results[1].value : null;
      
      setImages(imageData);
      setProcessingStatus(statusData);
      
      // If no images found in artwork_images table, check for legacy image_url
      if (imageData.length === 0) {
        logger.log(`[useLocalArtworkImages] No images found in artwork_images, checking legacy image_url`);
        
        const { data: artworkData, error: artworkError } = await supabase
          .from('artworks')
          .select('image_url')
          .eq('id', artworkId)
          .single();
        
        if (artworkError) {
          logger.error(`[useLocalArtworkImages] Error fetching legacy image_url:`, artworkError);
        } else if (artworkData?.image_url && artworkData.image_url !== '/placeholder.svg') {
          logger.log(`[useLocalArtworkImages] Found legacy image_url: ${artworkData.image_url}`);
          setLegacyImageUrl(artworkData.image_url);
        }
      }
      
      logger.log(`[useLocalArtworkImages] Loaded ${imageData.length} images`);
    } catch (err) {
      logger.error("[useLocalArtworkImages] Error fetching images:", err);
      setError("Failed to load images");
    } finally {
      setLoading(false);
    }
  }, [artworkId]);

  // Initial fetch
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Upload new image
  const uploadImage = useCallback(async (
    file: File,
    isPrimary: boolean = false,
    displayOrder?: number
  ) => {
    if (!artworkId) return { success: false, error: 'No artwork ID' };

    try {
      const order = displayOrder ?? images.length;
      const result = await LocalImageService.uploadAndProcessImage(
        file,
        artworkId,
        isPrimary,
        order
      );

      if (result.success) {
        // Refresh images list
        await fetchImages();
      }

      return result;
    } catch (error) {
      logger.error("[useLocalArtworkImages] Upload failed:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }, [artworkId, images.length, fetchImages]);

  // Get primary image with legacy fallback
  const primaryImage = images.find(img => img.is_primary) || images[0];

  // Create a synthetic image record for legacy image_url if no modern images exist
  const effectivePrimaryImage = primaryImage || (legacyImageUrl ? {
    id: `legacy-${artworkId}`,
    artwork_id: artworkId,
    image_url: legacyImageUrl,
    is_primary: true,
    display_order: 0,
    processing_status: 'completed',
    original_storage_path: null,
    thumbnail_storage_path: null,
    medium_storage_path: null,
    large_storage_path: null,
    thumbnail_url: null,
    medium_url: null,
    created_at: null,
    updated_at: null,
    original_width: null,
    original_height: null,
    thumbnail_width: null,
    thumbnail_height: null,
    processing_error: null
  } as LocalImageRecord : null);

  // Check if any images are still processing
  const hasProcessingImages = processingStatus.pending > 0 || processingStatus.processing > 0;

  return {
    images,
    primaryImage: effectivePrimaryImage,
    legacyImageUrl,
    loading,
    error,
    processingStatus,
    hasProcessingImages,
    uploadImage,
    refreshImages: fetchImages
  };
}
