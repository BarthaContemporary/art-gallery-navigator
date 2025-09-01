import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface EncryptedStorageCredentials {
  id: string;
  bucket_name: string;
  access_key: string;
  secret_key: string;
  endpoint_url: string;
  region: string;
}

export function useEncryptedStorage() {
  const [loading, setLoading] = useState(false);

  // Secure function to create encrypted admin storage credentials
  const createAdminCredentials = useCallback(async (
    name: string,
    userId: string,
    bucketName: string,
    accessKey: string,
    secretKey: string,
    endpointUrl = 'https://s3.idrivee2.com',
    region = 'us-east-1',
    isActive = true
  ) => {
    try {
      setLoading(true);
      
      // Use the secure function that encrypts credentials automatically
      const { data, error } = await supabase.rpc('insert_admin_storage_credentials', {
        p_name: name,
        p_user_id: userId,
        p_bucket_name: bucketName,
        p_access_key: accessKey,
        p_secret_key: secretKey,
        p_endpoint_url: endpointUrl,
        p_region: region,
        p_is_active: isActive
      });

      if (error) throw error;

      logger.log('[EncryptedStorage] Admin credentials created securely:', { id: data });
      toast.success('Storage credentials created and encrypted successfully');
      return data;
    } catch (error) {
      logger.error('[EncryptedStorage] Failed to create admin credentials:', error);
      toast.error('Failed to create storage credentials');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Secure function to create encrypted artist storage credentials
  const createArtistCredentials = useCallback(async (
    artistId: string,
    bucketName: string,
    accessKey: string,
    secretKey: string,
    endpointUrl = 'https://s3.idrivee2.com',
    region = 'us-east-1'
  ) => {
    try {
      setLoading(true);
      
      // Use the secure function that encrypts credentials automatically
      const { data, error } = await supabase.rpc('insert_artist_storage_credentials', {
        p_artist_id: artistId,
        p_bucket_name: bucketName,
        p_access_key: accessKey,
        p_secret_key: secretKey,
        p_endpoint_url: endpointUrl,
        p_region: region
      });

      if (error) throw error;

      logger.log('[EncryptedStorage] Artist credentials created securely:', { id: data });
      toast.success('Artist storage credentials created and encrypted successfully');
      return data;
    } catch (error) {
      logger.error('[EncryptedStorage] Failed to create artist credentials:', error);
      toast.error('Failed to create artist storage credentials');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Secure function to create encrypted shared storage credentials
  const createSharedCredentials = useCallback(async (
    name: string,
    bucketName: string,
    accessKey: string,
    secretKey: string,
    endpointUrl = 'https://s3.idrivee2.com',
    region = 'us-east-1',
    isActive = true
  ) => {
    try {
      setLoading(true);
      
      // Use the secure function that encrypts credentials automatically
      const { data, error } = await supabase.rpc('insert_shared_storage_credentials', {
        p_name: name,
        p_bucket_name: bucketName,
        p_access_key: accessKey,
        p_secret_key: secretKey,
        p_endpoint_url: endpointUrl,
        p_region: region,
        p_is_active: isActive
      });

      if (error) throw error;

      logger.log('[EncryptedStorage] Shared credentials created securely:', { id: data });
      toast.success('Shared storage credentials created and encrypted successfully');
      return data;
    } catch (error) {
      logger.error('[EncryptedStorage] Failed to create shared credentials:', error);
      toast.error('Failed to create shared storage credentials');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Secure function to get decrypted admin storage credentials
  const getAdminCredentials = useCallback(async (): Promise<EncryptedStorageCredentials[]> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_admin_storage_credentials_decrypted');

      if (error) throw error;

      logger.log('[EncryptedStorage] Retrieved admin credentials (decrypted)', { count: data?.length });
      return data || [];
    } catch (error) {
      logger.error('[EncryptedStorage] Failed to get admin credentials:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Secure function to get decrypted artist storage credentials
  const getArtistCredentials = useCallback(async (artistId?: string): Promise<EncryptedStorageCredentials[]> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_artist_storage_credentials_decrypted', {
        p_artist_id: artistId || null
      });

      if (error) throw error;

      logger.log('[EncryptedStorage] Retrieved artist credentials (decrypted)', { count: data?.length });
      return data || [];
    } catch (error) {
      logger.error('[EncryptedStorage] Failed to get artist credentials:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Secure function to get decrypted shared storage credentials
  const getSharedCredentials = useCallback(async (): Promise<EncryptedStorageCredentials[]> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_shared_storage_credentials_decrypted');

      if (error) throw error;

      logger.log('[EncryptedStorage] Retrieved shared credentials (decrypted)', { count: data?.length });
      return data || [];
    } catch (error) {
      logger.error('[EncryptedStorage] Failed to get shared credentials:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    createAdminCredentials,
    createArtistCredentials,
    createSharedCredentials,
    getAdminCredentials,
    getArtistCredentials,
    getSharedCredentials,
  };
}