
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function useProfileAvatarUpload() {
  const { user, session, refreshUser } = useAuth(); // refreshUser will be added to AuthContextType and useAuthActions
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadAvatar = async (file: File) => {
    if (!user || !session) {
      setUploadError('User not authenticated.');
      toast.error('Authentication required to upload avatar.');
      return null;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`; // Use user ID for the filename to ensure uniqueness and easy overwriting
      const filePath = `${user.id}/${fileName}`; // Store in a user-specific folder

      logger.log('Attempting to upload avatar:', { bucket: 'avatars', filePath });

      // Upload to Supabase Storage
      const { error: storageError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true, // Important to overwrite if an avatar already exists
        });

      if (storageError) {
        logger.error('Avatar storage upload error:', storageError);
        throw storageError;
      }

      if (!uploadData) {
        logger.error('Avatar storage upload returned no data.');
        throw new Error('Avatar storage upload returned no data.');
      }
      
      logger.log('Avatar uploaded to storage successfully:', uploadData.path);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path);

      if (!publicUrl) {
        logger.error('Failed to get public URL for avatar.');
        throw new Error('Failed to get public URL for avatar.');
      }
      
      logger.log('Avatar public URL:', publicUrl);

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (profileError) {
        logger.error('Error updating profile avatar_url:', profileError);
        throw profileError;
      }
      logger.log('Profile table updated with new avatar_url.');

      // Update user metadata in Supabase Auth for immediate reflection in user object
      const { error: userUpdateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (userUpdateError) {
        logger.error('Error updating user metadata (auth.updateUser):', userUpdateError);
        // Non-critical, profile is updated, but log it. The session might take a moment to reflect.
      } else {
        logger.log('User metadata (avatar_url) updated via auth.updateUser.');
      }
      
      // Refresh user data in auth context
      if (refreshUser) {
        await refreshUser();
        logger.log('Auth user state refreshed.');
      }


      toast.success('Profile avatar updated successfully!');
      return publicUrl;
    } catch (error: any) {
      logger.error('Avatar upload process failed:', error);
      setUploadError(error.message || 'Failed to upload avatar.');
      toast.error('Avatar upload failed', { description: error.message });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadAvatar, isUploading, uploadError };
}
