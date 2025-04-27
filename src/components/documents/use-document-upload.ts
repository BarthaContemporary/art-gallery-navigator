
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
        return;
      }
      
      // Validate that exactly one of artwork_id, collection_id, or artist_id is provided
      const hasArtwork = !!data.artwork_id && data.artwork_id !== "_none";
      const hasCollection = !!data.collection_id && data.collection_id !== "_none";
      const hasArtist = !!data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
      
      if (!hasArtwork && !hasCollection && !hasArtist) {
        toast.error("Please attach document to either an artwork, collection, or artist");
        setIsUploading(false);
        return;
      }
      
      if ((hasArtwork && hasCollection) || 
          (hasArtwork && hasArtist) || 
          (hasCollection && hasArtist)) {
        toast.error("Document can only be attached to one entity: artwork, collection, or artist");
        setIsUploading(false);
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

      // Create document record
      // CRITICAL: We must set unused foreign keys to NULL, not empty strings or "_none"
      const documentRecord = {
        file_name: file.name,
        file_url: publicUrl,
        type: data.type,
        description: data.description || null,
        // Only one of these should be non-null, the others MUST be null
        artwork_id: hasArtwork ? data.artwork_id : null,
        collection_id: hasCollection ? data.collection_id : null,
        artist_id: hasArtist ? data.artist_id : null
      };

      console.log("Inserting document with:", { 
        finalArtworkId: documentRecord.artwork_id, 
        finalCollectionId: documentRecord.collection_id,
        finalArtistId: documentRecord.artist_id,
        type: data.type,
        description: data.description || null
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
