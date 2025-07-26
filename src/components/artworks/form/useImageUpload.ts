
import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

export function useImageUpload(form: UseFormReturn<ArtworkFormData>) {
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);

  const handleImagesUploaded = (urls: string[]) => {
    if (urls.length > 0) {
      form.setValue("image_url", urls[0]);
      setUploadedImageUrls(urls);
    }
  };

  const handleArtsyImageSelected = (url: string) => {
    form.setValue("image_url", url);
    setUploadedImageUrls([url]);
  };

  const resetUploaded = () => setUploadedImageUrls([]);

  return { uploadedImageUrls, handleImagesUploaded, handleArtsyImageSelected, resetUploaded };
}
