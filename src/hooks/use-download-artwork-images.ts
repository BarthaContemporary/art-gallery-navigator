import { useState } from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { toast } from "sonner";
import { ImageUrlResolver } from "@/utils/image-url-resolver";

export function useDownloadArtworkImages(artworkId: string) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { images } = useLocalArtworkImages(artworkId);

  const downloadImage = async (imageRecord: any, filename: string) => {
    try {
      // Get the best quality URL (preferring original, then large, then medium)
      // Fix: Use 'full' instead of 'original' to match the expected parameter type
      const imageUrl = await ImageUrlResolver.getBestValidUrl(imageRecord, 'full');
      
      if (!imageUrl) {
        throw new Error('No valid image URL found');
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
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
    try {
      const downloadPromises = images.map(async (image, index) => {
        const filename = `artwork-image-${index + 1}-${image.id}.jpg`;
        await downloadImage(image, filename);
      });

      await Promise.all(downloadPromises);
      toast.success(`Downloaded ${images.length} image(s)`);
    } catch (error) {
      console.error('Failed to download images:', error);
      toast.error('Failed to download some images');
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
