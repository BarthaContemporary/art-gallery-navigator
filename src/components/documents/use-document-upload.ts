import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadFormData, uploadFormSchema } from "./upload-document-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSafeAsync } from "@/hooks/use-safe-async";

export function useDocumentUpload() {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { execute } = useSafeAsync();
  
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
    if (!data.file) {
      toast.error("Please select a file to upload");
      return;
    }
    
    const hasArtwork = data.artwork_id && data.artwork_id !== "_none";
    const hasCollection = data.collection_id && data.collection_id !== "_none";
    const hasArtist = data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
    
    const selectedEntities = [hasArtwork, hasCollection, hasArtist].filter(Boolean);
    
    if (selectedEntities.length === 0) {
      toast.error("Please attach document to an artwork, collection, or artist");
      return;
    }
    
    if (selectedEntities.length > 1) {
      toast.error("Document can only be attached to one entity: artwork, collection, or artist");
      return;
    }

    setIsUploading(true);
    
    await execute(
      async () => {
        const file = data.file!;
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileName = `${timestamp}_${randomStr}.${fileExt}`;

        const uploadResult = await supabase.storage
          .from('documents')
          .upload(fileName, file);
          
        if (uploadResult.error) {
          handleUploadError(uploadResult.error);
          throw uploadResult.error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        const documentRecord = {
          file_name: file.name,
          file_url: publicUrl,
          type: data.type,
          description: data.description || null,
          artwork_id: null,
          collection_id: null,
          artist_id: null
        };

        if (hasArtwork) {
          documentRecord.artwork_id = data.artwork_id;
        } else if (hasCollection) {
          documentRecord.collection_id = data.collection_id;
        } else if (hasArtist) {
          documentRecord.artist_id = data.artist_id;
        }

        const insertResult = await supabase
          .from('documents')
          .insert(documentRecord);

        if (insertResult.error) {
          console.error('Upload error:', insertResult.error);
          throw new Error("Failed to save document record: " + insertResult.error.message);
        }

        return { success: true };
      },
      {
        successMessage: "Document uploaded successfully",
        onSuccess: () => {
          setTimeout(() => {
            setOpen(false);
            form.reset({
              description: "",
              artwork_id: "_none",
              collection_id: "_none",
              artist_id: "",
              type: "",
              file: undefined
            });
            
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["documents"] });
            }, 100);
          }, 200);
        },
        finallyFn: () => {
          setIsUploading(false);
        }
      }
    );
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
