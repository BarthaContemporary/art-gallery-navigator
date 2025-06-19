
export interface ImageTier {
  url: string;
  width: number;
  height: number;
  quality: number;
}

export interface OptimizedImageConfig {
  originalUrl: string;
  alt?: string; // Made optional since it's not always needed for URL generation
  sizes: {
    thumbnail: { width: number; height: number; quality: number };
    medium: { width: number; height: number; quality: number };
    full: { width: number; height: number; quality: number };
  };
}

export type ImageTierType = 'thumbnail' | 'medium' | 'full';
