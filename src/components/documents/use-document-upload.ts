
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadFormData, uploadFormSchema } from "./upload-document-schema";
import { zodResolver } from "@hookform/resolvers/zod";

export function useDocumentUpload() {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  
  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      description: "",
      artwork_id: "",
      collection_id: "",
      artist_id: "",
      type: "",
    }
  });

  const handleUpload = async (data: UploadFormData) => {
    try {
      setIsUploading(true);
      
      if (!data.file) {
        toast.error("Please select a file to upload");
        return;
      }
      
      const file = data.file;
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}_${randomStr}.${fileExt}`;

      // Upload file to storage
      const uploadResult = await supabase.storage
        .from('documents')
        .upload(fileName, file);
        
      if (uploadResult.error) {
        handleUploadError(uploadResult.error);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Process form data to make sure we have valid values
      const finalArtworkId = data.artwork_id && data.artwork_id !== "_none" ? data.artwork_id : null;
      const finalCollectionId = data.collection_id && data.collection_id !== "_none" ? data.collection_id : null;
      const finalArtistId = data.artist_id && data.artist_id !== "_none" ? data.artist_id : null;

      console.log("Inserting document with:", { 
        finalArtworkId, 
        finalCollectionId,
        finalArtistId
      });

      // Insert record in database
      const insertResult = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          type: data.type,
          description: data.description || null,
          artwork_id: finalArtworkId,
          collection_id: finalCollectionId,
          artist_id: finalArtistId,
        });

      if (insertResult.error) {
        toast.error("Failed to save document record: " + insertResult.error.message);
        throw insertResult.error;
      }

      toast.success("Document uploaded successfully");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["documents"] });

    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleUploadError = (error: Error) => {
    if (error.message.includes("buckets")) {
      toast.error("Document storage not available. Contact administrator.", {
        description: "You don't have permission to use document storage"
      });
    } else {
      toast.error("Upload failed: " + error.message);
    }
  };

  return {
    form,
    open,
    setOpen,
    handleUpload,
    isUploading
  };
}
