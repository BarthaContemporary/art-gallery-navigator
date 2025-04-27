
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File, notes?: string) => {
    try {
      setIsUploading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be logged in to upload files');
      }

      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError, data } = await supabase.storage
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
      const { error: dbError } = await supabase
        .from('uploads')
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: user.id,
          notes
        });

      if (dbError) throw dbError;

      toast.success('File uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Upload failed: ' + (error.message || 'Unknown error'));
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}
