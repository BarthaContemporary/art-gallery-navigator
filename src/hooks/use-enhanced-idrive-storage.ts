import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StorageItem {
  name: string;
  size?: number;
  lastModified?: string;
  isFolder: boolean;
  key: string;
}

interface StorageCredentials {
  bucket_name: string;
  access_key: string;
  secret_key: string;
  endpoint_url: string;
}

interface BucketInfo {
  name: string;
  type: 'individual' | 'shared';
  credentials: StorageCredentials;
}

export function useEnhancedIDriveStorage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [availableBuckets, setAvailableBuckets] = useState<BucketInfo[]>([]);
  const [currentBucket, setCurrentBucket] = useState<BucketInfo | null>(null);

  const initializeStorage = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user's artist ID and admin status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some(role => role.role === 'gallery_admin');

      const buckets: BucketInfo[] = [];

      // Get shared bucket credentials (optional - table might not exist yet)
      try {
        const { data: sharedCreds, error: sharedError } = await supabase
          .from('shared_storage_credentials' as any)
          .select('*')
          .eq('is_active', true)
          .single();

        // Only add shared bucket if query succeeded and returned valid data
        if (!sharedError && 
            sharedCreds && 
            typeof sharedCreds === 'object' && 
            sharedCreds !== null &&
            'bucket_name' in sharedCreds &&
            'access_key' in sharedCreds &&
            'secret_key' in sharedCreds &&
            'endpoint_url' in sharedCreds) {
          // Cast to any to avoid TypeScript issues with dynamic table access
          const creds = sharedCreds as any;
          const bucketName = creds.bucket_name;
          const accessKey = creds.access_key;
          const secretKey = creds.secret_key;
          const endpointUrl = creds.endpoint_url;
          
          if (bucketName && accessKey && secretKey && endpointUrl) {
            buckets.push({
              name: 'Shared Gallery Storage',
              type: 'shared',
              credentials: {
                bucket_name: String(bucketName),
                access_key: String(accessKey),
                secret_key: String(secretKey),
                endpoint_url: String(endpointUrl),
              },
            });
          }
        }
      } catch (error) {
        console.error('Shared storage credentials not available:', error);
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

      setAvailableBuckets(buckets);
      
      // Set default bucket (prefer individual, fallback to shared)
      const defaultBucket = buckets.find(b => b.type === 'individual') || buckets[0];
      if (defaultBucket) {
        setCurrentBucket(defaultBucket);
      }

      return buckets;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      toast.error('Failed to initialize storage');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const switchBucket = useCallback((bucket: BucketInfo) => {
    setCurrentBucket(bucket);
    setItems([]);
  }, []);

  const listFiles = useCallback(async (prefix = '', bucket?: BucketInfo) => {
    try {
      setLoading(true);
      
      const targetBucket = bucket || currentBucket;
      if (!targetBucket) throw new Error('No bucket selected');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call proxy function with bucket context
      const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${prefix}?bucket=${targetBucket.credentials.bucket_name}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      // Parse S3 XML response
      const xmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      
      const contents = doc.querySelectorAll('Contents');
      const folders = doc.querySelectorAll('CommonPrefixes');
      
      const fileItems: StorageItem[] = Array.from(contents).map(content => ({
        name: content.querySelector('Key')?.textContent?.split('/').pop() || '',
        key: content.querySelector('Key')?.textContent || '',
        size: parseInt(content.querySelector('Size')?.textContent || '0'),
        lastModified: content.querySelector('LastModified')?.textContent || '',
        isFolder: false,
      }));

      const folderItems: StorageItem[] = Array.from(folders).map(folder => ({
        name: folder.querySelector('Prefix')?.textContent?.split('/').filter(Boolean).pop() || '',
        key: folder.querySelector('Prefix')?.textContent || '',
        isFolder: true,
      }));

      const allItems = [...folderItems, ...fileItems];
      setItems(allItems);
      return allItems;
    } catch (error) {
      console.error('Failed to list files:', error);
      toast.error('Failed to load files');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentBucket]);

  const uploadFile = useCallback(async (file: File, path = '', bucket?: BucketInfo) => {
    try {
      setLoading(true);
      
      const targetBucket = bucket || currentBucket;
      if (!targetBucket) throw new Error('No bucket selected');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const key = path ? `${path}/${file.name}` : file.name;
      
      const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${key}?bucket=${targetBucket.credentials.bucket_name}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      toast.success('File uploaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentBucket]);

  const createFolder = useCallback(async (folderName: string, currentPath = '', bucket?: BucketInfo) => {
    try {
      setLoading(true);
      
      const targetBucket = bucket || currentBucket;
      if (!targetBucket) throw new Error('No bucket selected');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const key = currentPath ? `${currentPath}/${folderName}/` : `${folderName}/`;
      
      const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${key}?bucket=${targetBucket.credentials.bucket_name}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/x-directory',
        },
        body: '',
      });

      if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.statusText}`);
      }

      toast.success('Folder created successfully');
      return true;
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentBucket]);

  const downloadFile = useCallback(async (key: string, bucket?: BucketInfo) => {
    try {
      const targetBucket = bucket || currentBucket;
      if (!targetBucket) throw new Error('No bucket selected');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${key}?bucket=${targetBucket.credentials.bucket_name}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = key.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error('Failed to download file');
      throw error;
    }
  }, [currentBucket]);

  return {
    loading,
    items,
    availableBuckets,
    currentBucket,
    initializeStorage,
    switchBucket,
    listFiles,
    uploadFile,
    createFolder,
    downloadFile,
  };
}