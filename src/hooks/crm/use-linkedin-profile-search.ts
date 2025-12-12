import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LinkedInProfile {
  name: string;
  profileUrl: string;
  headline?: string;
  snippet?: string;
  imageUrl?: string;
}

export function useLinkedInProfileSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchProfiles = useCallback(async (
    fullName: string,
    company?: string,
    jobTitle?: string
  ) => {
    if (!fullName) {
      setError('Full name is required');
      return [];
    }

    setIsSearching(true);
    setError(null);
    setProfiles([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('search-linkedin-profile', {
        body: { fullName, company, jobTitle },
      });

      if (fnError) throw fnError;

      const foundProfiles = data?.profiles || [];
      setProfiles(foundProfiles);
      return foundProfiles;
    } catch (err: any) {
      console.error('LinkedIn search error:', err);
      setError(err.message || 'Failed to search LinkedIn profiles');
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchProfileImage = useCallback(async (profileUrl: string): Promise<string | null> => {
    if (!profileUrl) return null;

    setIsFetchingImage(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-linkedin-profile-image', {
        body: { profileUrl },
      });

      if (fnError) throw fnError;

      return data?.imageUrl || null;
    } catch (err: any) {
      console.error('Failed to fetch LinkedIn image:', err);
      return null;
    } finally {
      setIsFetchingImage(false);
    }
  }, []);

  const downloadAndStoreImage = useCallback(async (
    imageUrl: string,
    contactId: string
  ): Promise<string | null> => {
    if (!imageUrl || !contactId) return null;

    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');

      const blob = await response.blob();
      const fileExt = 'jpg'; // LinkedIn images are typically JPEG
      const fileName = `${contactId}-profile.${fileExt}`;
      const filePath = `contact-profiles/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('crm-assets')
        .upload(filePath, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        // Try creating the bucket if it doesn't exist
        if (uploadError.message.includes('not found')) {
          console.log('Bucket may not exist, trying direct URL storage');
          return imageUrl; // Fall back to storing the URL directly
        }
        throw uploadError;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('crm-assets')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Failed to download and store image:', err);
      // Fall back to just returning the original URL
      return imageUrl;
    }
  }, []);

  const clearResults = useCallback(() => {
    setProfiles([]);
    setError(null);
  }, []);

  return {
    searchProfiles,
    fetchProfileImage,
    downloadAndStoreImage,
    clearResults,
    profiles,
    isSearching,
    isFetchingImage,
    error,
  };
}
