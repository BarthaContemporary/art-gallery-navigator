
export interface BulkProcessingProgress {
  total: number;
  processed: number;
  failed: number;
  current?: string;
  isRunning: boolean;
  artistsTotal?: number;
  artistsProcessed?: number;
  artistsFailed?: number;
}

export interface ProcessingOptions {
  quality: number;
  format: string;
  sharpen: boolean;
  autoOrient: boolean;
  watermark: boolean;
}

export interface UnprocessedCounts {
  artworkCount: number;
  artistCount: number;
  totalImages: number;
}
