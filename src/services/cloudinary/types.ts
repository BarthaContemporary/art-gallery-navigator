
export interface CloudinaryImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'limit' | 'scale';
}

export interface ImageProcessingStatus {
  isProcessed: boolean;
  needsProcessing: boolean;
  processingInProgress: boolean;
}

export type ImageTier = 'thumbnail' | 'medium' | 'full';
