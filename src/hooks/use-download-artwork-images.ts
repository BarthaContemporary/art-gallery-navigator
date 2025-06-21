
import { useState } from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useDownloadArtworkImages(artworkId: string) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { images } = useLocalArtworkImages(artworkId);

  const downloadImage = async (imageRecord: any, filename: string) => {
    try {
      let imageUrl = '';
      let isOriginal = false;
      
      // Priority 1: Try to get original file from storage bucket
      if (imageRecord.original_storage_path) {
        try {
          const { data } = supabase.storage
            .from('artwork-images-original')
            .getPublicUrl(imageRecord.original_storage_path);
          
          if (data?.publicUrl) {
            // For private buckets, we need to use the download method with auth
            const { data: downloadData, error } = await supabase.storage
              .from('artwork-images-original')
              .download(imageRecord.original_storage_path);
            
            if (!error && downloadData) {
              const url = URL.createObjectURL(downloadData);
              imageUrl = url;
              isOriginal = true;
              console.log(`[Download] Using original file from storage: ${imageRecord.original_storage_path}`);
            }
          }
        } catch (error) {
          console.warn(`[Download] Failed to access original storage file:`, error);
        }
      }
      
      // Priority 2: Fall back to image_url, medium_url, then thumbnail_url
      if (!imageUrl) {
        if (imageRecord.image_url && imageRecord.image_url !== '/placeholder.svg') {
          imageUrl = imageRecord.image_url;
        } else if (imageRecord.medium_url && imageRecord.medium_url !== '/placeholder.svg') {
          imageUrl = imageRecord.medium_url;
        } else if (imageRecord.thumbnail_url && imageRecord.thumbnail_url !== '/placeholder.svg') {
          imageUrl = imageRecord.thumbnail_url;
        }
      }
      
      if (!imageUrl || imageUrl === '/placeholder.svg') {
        throw new Error('No valid image URL found for download');
      }

      console.log(`[Download] Attempting to download: ${isOriginal ? 'original file' : imageUrl}`);

      // If we're using a blob URL (original file), handle it differently
      if (imageUrl.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(imageUrl);
      } else {
        // For regular URLs, fetch and download
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
      }
      
      console.log(`[Download] Successfully downloaded: ${filename} (${isOriginal ? 'original quality' : 'processed version'})`);
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
    let originalCount = 0;

    try {
      const downloadPromises = images.map(async (image, index) => {
        try {
          const filename = `artwork-image-${index + 1}-${image.id}.jpg`;
          await downloadImage(image, filename);
          successCount++;
          if (image.original_storage_path) {
            originalCount++;
          }
        } catch (error) {
          console.error(`Failed to download image ${index + 1}:`, error);
          errorCount++;
        }
      });

      await Promise.all(downloadPromises);

      if (successCount > 0 && errorCount === 0) {
        toast.success(`Downloaded ${successCount} image(s)`, {
          description: originalCount > 0 ? `${originalCount} in original quality` : undefined
        });
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
      const isOriginal = image.original_storage_path;
      toast.success('Image downloaded', {
        description: isOriginal ? 'Original quality file' : 'Processed version'
      });
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
