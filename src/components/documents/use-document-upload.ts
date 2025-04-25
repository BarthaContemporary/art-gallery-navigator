
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadFormData, uploadFormSchema } from "./upload-document-schema";

export function useDocumentUpload() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const form = useForm<UploadFormData>({
    defaultValues: {
      description: "",
      artwork_id: "",
      artist_id: "",
    }
  });

  const handleUpload = async (data: UploadFormData) => {
    try {
      const file = data.file;
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}_${randomStr}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) {
        if (uploadError.message.includes("buckets")) {
          toast.error("Document storage not available. Contact administrator.", {
            description: "You don't have permission to use document storage"
          });
        } else {
          toast.error("Upload failed: " + uploadError.message);
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          type: data.type,
          description: data.description || null,
          artwork_id: data.artwork_id || null,
          artist_id: data.artist_id || null,
        });

      if (insertError) {
        toast.error("Failed to save document record: " + insertError.message);
        throw insertError;
      }

      toast.success("Document uploaded successfully");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["documents"] });

    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  return {
    form,
    open,
    setOpen,
    handleUpload,
  };
}
