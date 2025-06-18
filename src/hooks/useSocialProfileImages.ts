
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SocialImageResult {
  imageUrl?: string;
  error?: string;
}

export function useSocialProfileImages() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinkedInImage = useCallback(async (profileInput: string): Promise<SocialImageResult> => {
    if (!profileInput) return { error: 'No profile input provided' };
    
    try {
      setIsLoading(true);
      
      // Clean and validate the input - handle both URLs and handles
      let profileUrl = profileInput;
      if (!profileInput.startsWith('http')) {
        // If it's just a handle, convert to full URL
        const cleanHandle = profileInput.replace('@', '').replace('linkedin.com/in/', '');
        profileUrl = `https://www.linkedin.com/in/${cleanHandle}`;
      }

      const { data, error } = await supabase.functions.invoke('fetch-linkedin-profile-image', {
        body: { profileUrl },
      });

      if (error) throw error;
      return { imageUrl: data?.imageUrl };
    } catch (error) {
      console.error('LinkedIn image fetch error:', error);
      return { error: 'Failed to fetch LinkedIn profile image' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInstagramImage = useCallback(async (usernameInput: string): Promise<SocialImageResult> => {
    if (!usernameInput) return { error: 'No username provided' };
    
    try {
      setIsLoading(true);
      
      // Clean the username input
      const username = usernameInput.replace('@', '').replace('instagram.com/', '').replace('https://www.instagram.com/', '');

      const { data, error } = await supabase.functions.invoke('fetch-instagram-profile-image', {
        body: { username },
      });

      if (error) throw error;
      return { imageUrl: data?.imageUrl };
    } catch (error) {
      console.error('Instagram image fetch error:', error);
      return { error: 'Failed to fetch Instagram profile image' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    fetchLinkedInImage,
    fetchInstagramImage,
    isLoading,
  };
}
