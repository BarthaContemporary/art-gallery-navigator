
import { useState } from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { toast } from "sonner";
import { ImageUrlService } from "@/services/image-url-service";

export function useDownloadArtworkImages(artworkId: string) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { images } = useLocalArtworkImages(artworkId);

  const downloadImage = async (imageRecord: any, filename: string) => {
    try {
      // Prioritize original image first, then fall back to processed versions
      let imageUrl = '';
      
      // First try original storage path for highest quality
      if (imageRecord.original_storage_path) {
        imageUrl = ImageUrlService.getBestImageUrl(imageRecord, 'original');
      }
      
      // If no original path or it's placeholder, try the original image_url
      if (!imageUrl || imageUrl === '/placeholder.svg') {
        imageUrl = imageRecord.image_url;
      }
      
      // Final fallback to largest processed version
      if (!imageUrl || imageUrl === '/placeholder.svg') {
        imageUrl = ImageUrlService.getBestImageUrl(imageRecord, 'large');
      }
      
      if (!imageUrl || imageUrl === '/placeholder.svg') {
        throw new Error('No valid image URL found for download');
      }

      console.log(`[Download] Attempting to download: ${imageUrl}`);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log(`[Download] Successfully downloaded: ${filename}`);
    } catch (error) {
      console.error('Failed to download image:', error);
      throw error;
    }
  };

  const downloadAllImages = async () => {
    if (images.length === 0) {
      toast.error('No images to download');
      return;
    }

    setIsDownloading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const downloadPromises = images.map(async (image, index) => {
        try {
          const filename = `artwork-image-${index + 1}-${image.id}.jpg`;
          await downloadImage(image, filename);
          successCount++;
        } catch (error) {
          console.error(`Failed to download image ${index + 1}:`, error);
          errorCount++;
        }
      });

      await Promise.all(downloadPromises);

      if (successCount > 0 && errorCount === 0) {
        toast.success(`Downloaded ${successCount} image(s)`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`Downloaded ${successCount} image(s), ${errorCount} failed`);
      } else {
        toast.error('Failed to download images');
      }
    } catch (error) {
      console.error('Failed to download images:', error);
      toast.error('Failed to download images');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadSingleImage = async (image: any, index: number) => {
    setIsDownloading(true);
    try {
      const filename = `artwork-image-${index + 1}-${image.id}.jpg`;
      await downloadImage(image, filename);
      toast.success('Image downloaded');
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Failed to download image');
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    downloadAllImages,
    downloadSingleImage,
    isDownloading,
    hasImages: images.length > 0,
    imageCount: images.length,
  };
}
