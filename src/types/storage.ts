export interface StorageItem {
  name: string;
  size?: number;
  lastModified?: string;
  isFolder: boolean;
  key: string;
}

export interface StorageCredentials {
  bucket_name: string;
  access_key: string;
  secret_key: string;
  endpoint_url: string;
}

export interface BucketInfo {
  name: string;
  type: 'individual' | 'shared';
  credentials: StorageCredentials;
}