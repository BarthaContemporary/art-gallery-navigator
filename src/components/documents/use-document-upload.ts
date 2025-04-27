
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
      artwork_id: "_none",
      collection_id: "_none",
      artist_id: "",
      type: "",
    }
  });

  const handleUpload = async (data: UploadFormData) => {
    try {
      setIsUploading(true);
      
      if (!data.file) {
        toast.error("Please select a file to upload");
        setIsUploading(false);
        return;
      }
      
      // Parse and validate the associations
      const hasArtwork = data.artwork_id && data.artwork_id !== "_none";
      const hasCollection = data.collection_id && data.collection_id !== "_none";
      const hasArtist = data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
      
      // Count selected entities to ensure exactly one is chosen
      const selectedEntities = [hasArtwork, hasCollection, hasArtist].filter(Boolean);
      
      if (selectedEntities.length === 0) {
        toast.error("Please attach document to an artwork, collection, or artist");
        setIsUploading(false);
        return;
      }
      
      if (selectedEntities.length > 1) {
        toast.error("Document can only be attached to one entity: artwork, collection, or artist");
        setIsUploading(false);
        return;
      }
      
      // File upload logic
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
        setIsUploading(false);
        return;
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Prepare document record with proper NULL handling for the database
      const documentRecord = {
        file_name: file.name,
        file_url: publicUrl,
        type: data.type,
        description: data.description || null,
        // Set only one field and ensure others are NULL
        artwork_id: hasArtwork ? data.artwork_id : null,
        collection_id: hasCollection ? data.collection_id : null,
        artist_id: hasArtist ? data.artist_id : null
      };

      // Debug log to help diagnose issues
      console.log("Inserting document record:", { 
        artwork_id: documentRecord.artwork_id, 
        collection_id: documentRecord.collection_id,
        artist_id: documentRecord.artist_id,
        type: data.type
      });

      // Insert record in database
      const insertResult = await supabase
        .from('documents')
        .insert(documentRecord);

      if (insertResult.error) {
        console.error('Upload error:', insertResult.error);
        toast.error("Failed to save document record: " + insertResult.error.message);
        setIsUploading(false);
        return;
      }

      toast.success("Document uploaded successfully");
      setOpen(false);
      form.reset({
        description: "",
        artwork_id: "_none",
        collection_id: "_none",
        artist_id: "",
        type: "",
      });
      queryClient.invalidateQueries({ queryKey: ["documents"] });

    } catch (error) {
      console.error('Upload error:', error);
      toast.error("An unexpected error occurred during upload");
      setIsUploading(false);
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
