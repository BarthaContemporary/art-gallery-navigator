
import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useImageUpload(form: UseFormReturn<ArtworkFormData>) {
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);

  const handleImagesUploaded = (urls: string[]) => {
    if (urls.length > 0) {
      form.setValue("image_url", urls[0]);
      setUploadedImageUrls(urls);
    }
  };

  const handleArtsyImageSelected = async (urls: string[]) => {
    try {
      toast.loading(`Downloading and uploading ${urls.length} image(s)...`);
      
      const uploadedUrls: string[] = [];
      
      // Process each URL
      for (const url of urls) {
        try {
          // Fetch the external image
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch image');
          
          const blob = await response.blob();
          
          // Create a file from the blob
          const filename = `external-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${blob.type.split('/')[1] || 'jpg'}`;
          const file = new File([blob], filename, { type: blob.type });
          
          // Upload to Supabase storage
          const { data, error } = await supabase.storage
            .from('artwork-images-original')
            .upload(`external/${filename}`, file);
          
          if (error) throw error;
          
          // Get the public URL
          const { data: urlData } = supabase.storage
            .from('artwork-images-original')
            .getPublicUrl(data.path);
          
          if (urlData?.publicUrl) {
            uploadedUrls.push(urlData.publicUrl);
          }
        } catch (error) {
          console.error('Error uploading individual image:', error);
        }
      }
      
      if (uploadedUrls.length > 0) {
        // Set the first image as the primary image
        form.setValue("image_url", uploadedUrls[0]);
        setUploadedImageUrls(uploadedUrls);
        toast.dismiss();
        if (uploadedUrls.length === urls.length) {
          toast.success(`All ${uploadedUrls.length} images uploaded successfully`);
        } else {
          toast.success(`${uploadedUrls.length} of ${urls.length} images uploaded successfully`);
        }
      } else {
        throw new Error('No images were uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading external images:', error);
      toast.dismiss();
      toast.error("Failed to upload images. Please try again.");
    }
  };

  const resetUploaded = () => setUploadedImageUrls([]);

  return { uploadedImageUrls, handleImagesUploaded, handleArtsyImageSelected, resetUploaded };
}
