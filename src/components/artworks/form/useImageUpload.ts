
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

  const handleArtsyImageSelected = async (url: string) => {
    try {
      toast.loading("Downloading and uploading image...");
      
      // Fetch the external image
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      
      // Create a file from the blob
      const filename = `external-image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
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
        form.setValue("image_url", urlData.publicUrl);
        setUploadedImageUrls([urlData.publicUrl]);
        toast.dismiss();
        toast.success("Image uploaded successfully");
      }
    } catch (error) {
      console.error('Error uploading external image:', error);
      toast.dismiss();
      toast.error("Failed to upload image. Please try again.");
    }
  };

  const resetUploaded = () => setUploadedImageUrls([]);

  return { uploadedImageUrls, handleImagesUploaded, handleArtsyImageSelected, resetUploaded };
}
