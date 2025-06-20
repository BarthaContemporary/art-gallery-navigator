
import { useState, useEffect, useCallback } from "react";
import { LocalImageService, type LocalImageRecord } from "@/services/local-image-service";
import { logger } from "@/lib/logger";

export function useLocalArtworkImages(artworkId: string) {
  const [images, setImages] = useState<LocalImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  });

  // Fetch images
  const fetchImages = useCallback(async () => {
    if (!artworkId) {
      setImages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      logger.log(`[useLocalArtworkImages] Fetching images for artwork: ${artworkId}`);
      
      const [imageData, statusData] = await Promise.all([
        LocalImageService.getArtworkImages(artworkId),
        LocalImageService.getProcessingStatus(artworkId)
      ]);
      
      setImages(imageData);
      setProcessingStatus(statusData);
      
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

  // Get primary image
  const primaryImage = images.find(img => img.is_primary) || images[0];

  // Check if any images are still processing
  const hasProcessingImages = processingStatus.pending > 0 || processingStatus.processing > 0;

  return {
    images,
    primaryImage,
    loading,
    error,
    processingStatus,
    hasProcessingImages,
    uploadImage,
    refreshImages: fetchImages
  };
}
