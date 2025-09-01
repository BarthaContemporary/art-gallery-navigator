import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { supabase } from "@/integrations/supabase/client";

interface ArtistStorageCredentials {
  bucket_name: string;
  access_key: string;
  secret_key: string;
  endpoint_url: string;
  region: string;
}

export function useArtistStorage() {
  const { isArtist } = useAuth();
  const currentUserArtist = useCurrentUserArtist();
  const [credentials, setCredentials] = useState<ArtistStorageCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isArtist && currentUserArtist?.id) {
      fetchArtistCredentials();
    }
  }, [isArtist, currentUserArtist?.id]);

  const fetchArtistCredentials = async () => {
    if (!currentUserArtist?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use the secure function to get decrypted credentials
      const { data, error } = await supabase.rpc('get_artist_storage_credentials_decrypted', {
        p_artist_id: currentUserArtist.id
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        setError('No storage credentials configured for your artist account.');
      } else {
        setCredentials(data[0]); // Take the first credential
      }
    } catch (err) {
      console.error('Error fetching artist storage credentials:', err);
      setError('Failed to fetch storage credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const getArtistBucketName = () => {
    if (!currentUserArtist?.full_name) return null;
    
    // Convert artist name to bucket-friendly format
    // e.g., "Jill Baroff" -> "jillbaroff"
    return currentUserArtist.full_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  return {
    credentials,
    isLoading,
    error,
    bucketName: getArtistBucketName(),
    hasCredentials: !!credentials,
    refetch: fetchArtistCredentials,
  };
}