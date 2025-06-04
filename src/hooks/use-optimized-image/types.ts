
export interface ImageTier {
  url: string;
  width: number;
  height: number;
  quality: number;
}

export interface OptimizedImageConfig {
  originalUrl: string;
  alt: string;
  sizes: {
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

export type ImageTierType = 'thumbnail' | 'medium' | 'full';
