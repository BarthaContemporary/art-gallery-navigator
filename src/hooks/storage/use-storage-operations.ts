import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BucketInfo, StorageItem } from '@/types/storage';

export function useStorageOperations() {
  const listFiles = useCallback(async (prefix = '', bucket?: BucketInfo): Promise<StorageItem[]> => {
    if (!bucket) {
      console.error('No bucket selected for listing files');
      return [];
    }

    console.log('Listing files for bucket:', bucket.name, 'prefix:', prefix);

    try {
      // Return mock data based on bucket type
      const isSharedBucket = bucket.type === 'shared' || bucket.name.toLowerCase().includes('shared') || bucket.name.toLowerCase().includes('gallery');
      
      if (isSharedBucket) {
        // Return mock files for shared buckets
        return [
          {
            name: 'documents',
            key: 'documents/',
            isFolder: true,
          },
          {
            name: 'images',
            key: 'images/',
            isFolder: true,
          },
          {
            name: 'sample.pdf',
            key: 'sample.pdf',
            size: 1024000,
            lastModified: '2024-01-15T12:00:00.000Z',
            isFolder: false,
          },
          {
            name: 'photo.jpg',
            key: 'photo.jpg',
            size: 2048000,
            lastModified: '2024-01-15T12:30:00.000Z',
            isFolder: false,
          },
        ];
      } else {
        // Return empty array for non-shared buckets
        return [];
      }
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }, []);

  const uploadFile = useCallback(async (file: File, path = '', bucket?: BucketInfo): Promise<boolean> => {
    if (!bucket) throw new Error('No bucket selected');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const key = path ? `${path}/${file.name}` : file.name;
    
    const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${key}?bucket=${bucket.credentials.bucket_name}`, {
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
  }, []);

  const createFolder = useCallback(async (folderName: string, currentPath = '', bucket?: BucketInfo): Promise<boolean> => {
    if (!bucket) throw new Error('No bucket selected');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const key = currentPath ? `${currentPath}/${folderName}/` : `${folderName}/`;
    
    const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${key}?bucket=${bucket.credentials.bucket_name}`, {
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
  }, []);

  const downloadFile = useCallback(async (key: string, bucket?: BucketInfo): Promise<void> => {
    if (!bucket) throw new Error('No bucket selected');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/${key}?bucket=${bucket.credentials.bucket_name}`, {
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
  }, []);

  return {
    listFiles,
    uploadFile,
    createFolder,
    downloadFile,
  };
}