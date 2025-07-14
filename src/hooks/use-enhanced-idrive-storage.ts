import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useStorageInitialization } from './storage/use-storage-initialization';
import { useStorageOperations } from './storage/use-storage-operations';
import type { StorageItem, BucketInfo } from '@/types/storage';

export function useEnhancedIDriveStorage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [availableBuckets, setAvailableBuckets] = useState<BucketInfo[]>([]);
  const [currentBucket, setCurrentBucket] = useState<BucketInfo | null>(null);

  const { initializeStorage: initStorage } = useStorageInitialization();
  const { listFiles: listStorageFiles, uploadFile: uploadStorageFile, createFolder: createStorageFolder, downloadFile: downloadStorageFile } = useStorageOperations();

  const initializeStorage = useCallback(async () => {
    try {
      setLoading(true);
      const buckets = await initStorage();
      setAvailableBuckets(buckets);
      
      // Don't auto-select bucket here - let the component handle it based on mode
      console.log('Storage initialized with buckets:', buckets.map(b => ({ name: b.name, type: b.type })));

      return buckets;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      toast.error('Failed to initialize storage');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [initStorage]);

  const switchBucket = useCallback((bucket: BucketInfo | null) => {
    setCurrentBucket(bucket);
    setItems([]);
  }, []);

  const listFiles = useCallback(async (prefix = '', bucket?: BucketInfo) => {
    try {
      setLoading(true);
      const targetBucket = bucket || currentBucket;
      const items = await listStorageFiles(prefix, targetBucket);
      setItems(items);
      return items;
    } catch (error) {
      console.error('Failed to list files:', error);
      toast.error('Failed to load files');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentBucket, listStorageFiles]);

  const uploadFile = useCallback(async (file: File, path = '', bucket?: BucketInfo) => {
    try {
      setLoading(true);
      const targetBucket = bucket || currentBucket;
      return await uploadStorageFile(file, path, targetBucket);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentBucket, uploadStorageFile]);

  const createFolder = useCallback(async (folderName: string, currentPath = '', bucket?: BucketInfo) => {
    try {
      setLoading(true);
      const targetBucket = bucket || currentBucket;
      return await createStorageFolder(folderName, currentPath, targetBucket);
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentBucket, createStorageFolder]);

  const downloadFile = useCallback(async (key: string, bucket?: BucketInfo) => {
    try {
      const targetBucket = bucket || currentBucket;
      await downloadStorageFile(key, targetBucket);
    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error('Failed to download file');
      throw error;
    }
  }, [currentBucket, downloadStorageFile]);

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