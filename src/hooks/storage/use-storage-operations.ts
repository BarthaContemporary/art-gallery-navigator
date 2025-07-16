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
      console.log('🔐 Getting user session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('❌ User not authenticated');
        return [];
      }
      console.log('✅ User session obtained');

      // Use the actual bucket name from credentials
      const actualBucketName = bucket.credentials.bucket_name;
      // Normalize Unicode characters consistently and format prefix
      const normalizedPrefix = prefix ? prefix.normalize('NFC') : '';
      const formattedPrefix = normalizedPrefix && !normalizedPrefix.endsWith('/') ? `${normalizedPrefix}/` : normalizedPrefix;
      console.log('🌐 Calling edge function with supabase client...');
      console.log('📦 Using bucket name:', actualBucketName);
      console.log('📁 Using prefix:', formattedPrefix);
      console.log('📁 Normalized prefix bytes:', new TextEncoder().encode(formattedPrefix));

      const { data, error } = await supabase.functions.invoke('idrive-proxy', {
        body: {
          bucket: actualBucketName,
          prefix: formattedPrefix
        }
      });

      console.log('📡 Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        return [];
      }

      // The response should be XML text
      const xmlText = data;
      console.log('📄 Raw XML response length:', xmlText.length);
      console.log('📄 Raw XML response:', xmlText);
      
      if (!xmlText) {
        console.error('Empty XML response');
        return [];
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parsing error:', parseError.textContent);
        return [];
      }
      
      console.log('📋 Parsed XML document:', doc);
      console.log('📋 Document root element:', doc.documentElement);
      
      const contents = doc.querySelectorAll('Contents');
      const folders = doc.querySelectorAll('CommonPrefixes');
      
      console.log('🔍 Found contents:', contents.length, 'folders:', folders.length);
      
      // Debug each content element
      contents.forEach((content, index) => {
        const key = content.querySelector('Key')?.textContent || '';
        const size = content.querySelector('Size')?.textContent || '';
        const lastModified = content.querySelector('LastModified')?.textContent || '';
        console.log(`📁 Content ${index}:`, { key, size, lastModified });
      });
      
      // Debug each folder element
      folders.forEach((folder, index) => {
        const prefix = folder.querySelector('Prefix')?.textContent || '';
        console.log(`📂 Folder ${index}:`, { prefix });
      });
      
      const fileItems: StorageItem[] = Array.from(contents)
        .filter(content => {
          const key = content.querySelector('Key')?.textContent || '';
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

      // Create folders from file paths - improved logic
      const folderSet = new Set<string>();
      const currentPrefix = formattedPrefix || '';
      
      Array.from(contents).forEach(content => {
        const key = content.querySelector('Key')?.textContent || '';
        
        // Skip the key if it doesn't start with current prefix
        if (currentPrefix && !key.startsWith(currentPrefix)) {
          return;
        }
        
        // Get the relative path from current location
        const relativePath = currentPrefix ? key.slice(currentPrefix.length) : key;
        
        // Skip if this is just a folder marker (ends with /)
        if (relativePath.endsWith('/')) {
          const pathParts = relativePath.split('/').filter(Boolean);
          if (pathParts.length === 1) {
            // This is a direct subfolder
            const folderName = pathParts[0];
            folderSet.add(currentPrefix + folderName + '/');
          }
          return;
        }
        
        // For files, extract the immediate parent folder
        const pathParts = relativePath.split('/').filter(Boolean);
        if (pathParts.length > 1) {
          // This file is in a subfolder at the current level
          const folderName = pathParts[0];
          const folderPath = currentPrefix + folderName + '/';
          folderSet.add(folderPath);
        }
      });

      // Create folder items from the set
      const folderItems: StorageItem[] = Array.from(folderSet).map(folderPath => {
        const name = folderPath.split('/').filter(Boolean).pop() || '';
        return {
          name,
          key: folderPath,
          isFolder: true,
        };
      });

      // Also process CommonPrefixes if they exist
      const commonPrefixFolders: StorageItem[] = Array.from(folders).map(folder => {
        const prefixText = folder.querySelector('Prefix')?.textContent || '';
        console.log('🔍 Processing folder prefix:', prefixText);
        
        const currentPrefix = formattedPrefix || '';
        const folderPath = prefixText.startsWith(currentPrefix) 
          ? prefixText.slice(currentPrefix.length)
          : prefixText;
        
        const name = folderPath.replace(/\/$/, '').split('/')[0] || '';
        console.log('📁 Extracted folder name:', name, 'from prefix:', prefixText);
        
        return {
          name,
          key: prefixText,
          isFolder: true,
        };
      });

      // Combine all folders and remove duplicates
      const allFolders = [...folderItems, ...commonPrefixFolders];
      const uniqueFolders = allFolders.filter((folder, index, self) => 
        index === self.findIndex(f => f.key === folder.key)
      );

      // Filter files to only show those at the current level
      const currentLevelFiles = fileItems.filter(file => {
        // If no prefix, show all files without subfolders
        if (!formattedPrefix) {
          return !file.key.includes('/');
        }
        
        // If file starts with current prefix, check if it's directly in this folder
        if (file.key.startsWith(formattedPrefix)) {
          const relativePath = file.key.slice(formattedPrefix.length);
          // Show files that don't have any more folder separators
          return !relativePath.includes('/');
        }
        
        return false;
      });

      const items = [...uniqueFolders, ...currentLevelFiles];
      console.log('✅ Processed items - Files:', currentLevelFiles.length, 'Folders:', uniqueFolders.length);
      console.log('✅ Final items:', items);
      return items;
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