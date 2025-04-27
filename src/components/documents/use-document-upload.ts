
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
      
      // Determine which entity is selected and properly format values
      const hasArtwork = data.artwork_id && data.artwork_id !== "_none";
      const hasCollection = data.collection_id && data.collection_id !== "_none";
      const hasArtist = data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
      
      // Ensure exactly one entity is selected
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
      // Important: Convert "_none" and empty strings to null
      const documentRecord = {
        file_name: file.name,
        file_url: publicUrl,
        type: data.type,
        description: data.description || null,
        // Set all fields initially to null
        artwork_id: null,
        collection_id: null,
        artist_id: null
      };

      // Now set only the appropriate field based on what was selected
      if (hasArtwork) {
        documentRecord.artwork_id = data.artwork_id;
      } else if (hasCollection) {
        documentRecord.collection_id = data.collection_id;
      } else if (hasArtist) {
        documentRecord.artist_id = data.artist_id;
      }

      // Debug log to help diagnose issues
      console.log("Inserting document record:", documentRecord);

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
        file: undefined
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
