
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
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}_${file.name}`;
      
      console.log('Attempting upload to documents bucket:', fileName);
      
      const { error: uploadError, data } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);
      
      console.log('File uploaded successfully, public URL:', publicUrl);

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

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw dbError;
      }

      toast.success('File uploaded successfully');
      return publicUrl;
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
