import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BucketInfo, StorageItem } from '@/types/storage';

export function useStorageOperations() {
  const listFiles = useCallback(async (prefix = '', bucket?: BucketInfo): Promise<StorageItem[]> => {
    if (!bucket) {
      console.error('No bucket selected for listing files');
      throw new Error('No bucket selected');
    }

    console.log('Listing files for bucket:', bucket.name, 'prefix:', prefix);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('User not authenticated');
      throw new Error('Not authenticated');
    }

    // Call proxy function with bucket context - format prefix correctly for folders
    const formattedPrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
    const url = `https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/idrive-proxy/?bucket=${bucket.credentials.bucket_name}${formattedPrefix ? `&prefix=${encodeURIComponent(formattedPrefix)}` : ''}`;
    console.log('Fetching from URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to list files:', response.status, response.statusText, errorText);
      throw new Error(`Failed to list files: ${response.statusText} - ${errorText}`);
    }

    // Parse S3 XML response
    const xmlText = await response.text();
    console.log('Raw XML response:', xmlText);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parsing error:', parseError.textContent);
      throw new Error('Failed to parse XML response');
    }
    
    const contents = doc.querySelectorAll('Contents');
    const folders = doc.querySelectorAll('CommonPrefixes');
    
    console.log('Found contents:', contents.length, 'folders:', folders.length);
    
    const fileItems: StorageItem[] = Array.from(contents)
      .filter(content => {
        const key = content.querySelector('Key')?.textContent || '';
        // Filter out files that should be treated as folders (ending with /)
        return !key.endsWith('/');
      })
      .map(content => {
        const key = content.querySelector('Key')?.textContent || '';
        const name = key.split('/').pop() || '';
        return {
          name,
          key,
          size: parseInt(content.querySelector('Size')?.textContent || '0'),
          lastModified: content.querySelector('LastModified')?.textContent || '',
          isFolder: false,
        };
      });

    const folderItems: StorageItem[] = Array.from(folders).map(folder => {
      const prefix = folder.querySelector('Prefix')?.textContent || '';
      const name = prefix.split('/').filter(Boolean).pop() || '';
      return {
        name,
        key: prefix,
        isFolder: true,
      };
    });

    console.log('Processed items - Files:', fileItems.length, 'Folders:', folderItems.length);
    console.log('Folder items:', folderItems);
    console.log('File items:', fileItems);

    return [...folderItems, ...fileItems];
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