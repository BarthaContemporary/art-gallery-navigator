
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File, notes?: string) => {
    try {
      setIsUploading(true);

      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('large-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('large-uploads')
        .getPublicUrl(fileName);

      // Record the upload in the database
      // Using 'as any' to bypass TypeScript errors temporarily
      const { error: dbError } = await (supabase
        .from('uploads' as any)
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: supabase.auth.getUser().then(({ data }) => data?.user?.id),
          notes
        } as any));

      if (dbError) throw dbError;

    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}
