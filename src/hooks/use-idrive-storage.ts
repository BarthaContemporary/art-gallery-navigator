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

export function useIDriveStorage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [credentials, setCredentials] = useState<StorageCredentials | null>(null);

  const initializeStorage = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user's artist ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: artist, error: artistError } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (artistError) throw artistError;

      // Get storage credentials using the secure function
      const { data: credsArray, error: credError } = await supabase.rpc('get_artist_storage_credentials_decrypted', {
        p_artist_id: artist.id
      });

      if (credError || !credsArray || credsArray.length === 0) {
        throw new Error('Storage not configured for this artist');
      }

      const creds = credsArray[0]; // Take the first credential

      setCredentials(creds);
      return creds;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      toast.error('Failed to initialize storage');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const listFiles = useCallback(async (prefix = '') => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call our proxy function to list files
      const response = await fetch(`/functions/v1/idrive-proxy/${prefix}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      // Parse S3 XML response (simplified)
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
  }, []);

  const uploadFile = useCallback(async (file: File, path = '') => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const key = path ? `${path}/${file.name}` : file.name;
      
      const response = await fetch(`/functions/v1/idrive-proxy/${key}`, {
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
  }, []);

  const createFolder = useCallback(async (folderName: string, currentPath = '') => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const key = currentPath ? `${currentPath}/${folderName}/` : `${folderName}/`;
      
      // Create folder by uploading empty object with trailing slash
      const response = await fetch(`/functions/v1/idrive-proxy/${key}`, {
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
  }, []);

  const downloadFile = useCallback(async (key: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/functions/v1/idrive-proxy/${key}`, {
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
  }, []);

  return {
    loading,
    items,
    credentials,
    initializeStorage,
    listFiles,
    uploadFile,
    createFolder,
    downloadFile,
  };
}