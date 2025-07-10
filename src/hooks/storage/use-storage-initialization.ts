import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BucketInfo, StorageCredentials } from '@/types/storage';

export function useStorageInitialization() {
  const initializeStorage = useCallback(async (): Promise<BucketInfo[]> => {
    try {
      console.log('Initializing storage...');
      
      // Get current user's artist ID and admin status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some(role => role.role === 'gallery_admin');
      console.log('User is admin:', isAdmin);

      const buckets: BucketInfo[] = [];

      // Get shared bucket credentials (optional - table might not exist yet)
      try {
        const { data: sharedCredsArray, error: sharedError } = await supabase
          .from('shared_storage_credentials' as any)
          .select('*')
          .eq('is_active', true)
          .limit(1);

        const sharedCreds = sharedCredsArray?.[0] || null;

        console.log('Shared storage credentials query result:', { sharedCreds, sharedError });

        // Only add shared bucket if query succeeded and returned valid data
        if (!sharedError && sharedCreds && typeof sharedCreds === 'object') {
          const creds = sharedCreds as any;
          if (creds.bucket_name && creds.access_key && creds.secret_key && creds.endpoint_url) {
            console.log('Adding shared bucket:', creds.bucket_name);
            buckets.push({
              name: 'Shared Gallery Storage',
              type: 'shared',
              credentials: {
                bucket_name: String(creds.bucket_name),
                access_key: String(creds.access_key),
                secret_key: String(creds.secret_key),
                endpoint_url: String(creds.endpoint_url),
              },
            });
          }
        }
      } catch (error) {
        console.error('Shared storage credentials not available:', error);
      }

      // If admin, get admin storage credentials
      if (isAdmin) {
        const { data: adminCreds, error: adminError } = await supabase
          .from('admin_storage_credentials')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (!adminError && adminCreds) {
          adminCreds.forEach(cred => {
            // Avoid duplicates by checking bucket name
            if (!buckets.find(b => b.credentials.bucket_name === cred.bucket_name)) {
              buckets.push({
                name: cred.name,
                type: 'admin',
                credentials: {
                  bucket_name: cred.bucket_name,
                  access_key: cred.access_key,
                  secret_key: cred.secret_key,
                  endpoint_url: cred.endpoint_url,
                },
              });
            }
          });
        }
      }

      // Get individual artist bucket if user is an artist
      const { data: artist } = await supabase
        .from('artists')
        .select('id, full_name')
        .eq('user_id', user.id)
        .single();

      if (artist) {
        const { data: artistCreds, error: artistError } = await supabase
          .from('artist_storage_credentials')
          .select('*')
          .eq('artist_id', artist.id)
          .single();

        if (!artistError && artistCreds) {
          buckets.push({
            name: `${artist.full_name}'s Storage`,
            type: 'individual',
            credentials: artistCreds,
          });
        }
      }

      // If admin, get all artist buckets for management
      if (isAdmin) {
        const { data: allCreds } = await supabase
          .from('artist_storage_credentials')
          .select(`
            *,
            artists!inner(full_name)
          `);

        if (allCreds) {
          allCreds.forEach(cred => {
            if (!buckets.find(b => b.credentials.bucket_name === cred.bucket_name)) {
              buckets.push({
                name: `${(cred as any).artists.full_name}'s Storage`,
                type: 'individual',
                credentials: cred,
              });
            }
          });
        }
      }

      console.log('Initialized storage with buckets:', buckets);
      return buckets;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      toast.error('Failed to initialize storage');
      throw error;
    }
  }, []);

  return { initializeStorage };
}