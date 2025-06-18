
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SocialImageResult {
  imageUrl?: string;
  error?: string;
}

export function useSocialProfileImages() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinkedInImage = useCallback(async (profileUrl: string): Promise<SocialImageResult> => {
    if (!profileUrl) return { error: 'No profile URL provided' };
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-linkedin-profile-image', {
        body: { profileUrl },
      });

      if (error) throw error;
      return { imageUrl: data.imageUrl };
    } catch (error) {
      console.error('LinkedIn image fetch error:', error);
      return { error: 'Failed to fetch LinkedIn profile image' };
    }
  }, []);

  const fetchInstagramImage = useCallback(async (username: string): Promise<SocialImageResult> => {
    if (!username) return { error: 'No username provided' };
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-instagram-profile-image', {
        body: { username },
      });

      if (error) throw error;
      return { imageUrl: data.imageUrl };
    } catch (error) {
      console.error('Instagram image fetch error:', error);
      return { error: 'Failed to fetch Instagram profile image' };
    }
  }, []);

  return {
    fetchLinkedInImage,
    fetchInstagramImage,
    isLoading,
  };
}
