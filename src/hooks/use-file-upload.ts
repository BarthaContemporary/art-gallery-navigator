
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File, notes?: string) => {
    try {
      setIsUploading(true);

      // Create a unique filename prefixed with the user's ID
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('User not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Upload file to storage
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

      // Record the upload in the database - using type assertion to work with the new uploads table
      const { error: dbError } = await supabase
        .from('uploads' as any)
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: userId,
          notes
        } as any);

      if (dbError) throw dbError;

      toast({
        title: "Upload successful",
        description: "Your file has been uploaded successfully."
      });

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}
