
import { logger } from "@/lib/logger";
import type { CloudinaryImageOptions, ImageTier } from "./types";

export class CloudinaryUrlOptimizer {
  private static cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  static isCloudinaryConfigured(): boolean {
    return !!this.cloudName && this.cloudName !== 'demo';
  }

  static getOptimizedUrl(
    originalUrl: string | null,
    tier: ImageTier,
    options: CloudinaryImageOptions = {}
  ): string {
    if (!originalUrl || originalUrl === '/placeholder.svg') {
      return '/placeholder.svg';
    }

    // If Cloudinary is not configured, return original URL
    if (!this.isCloudinaryConfigured()) {
      logger.warn('Cloudinary not configured, returning original URL');
      return originalUrl;
    }

    // If it's already a Cloudinary URL, return as is
    if (originalUrl.includes('res.cloudinary.com')) {
      return originalUrl;
    }

    // Generate Cloudinary fetch URL with optimizations
    const defaultOptions = this.getDefaultOptionsForTier(tier);
    const mergedOptions = { ...defaultOptions, ...options };
    
    const transformations = this.buildTransformations(mergedOptions);
    return `https://res.cloudinary.com/${this.cloudName}/image/fetch/${transformations}/${encodeURIComponent(originalUrl)}`;
  }

  static getDefaultOptionsForTier(tier: ImageTier): CloudinaryImageOptions {
    switch (tier) {
      case 'thumbnail':
        return { width: 400, height: 400, quality: 85, format: 'auto', crop: 'fill' };
      case 'medium':
        return { width: 800, height: 800, quality: 90, format: 'auto', crop: 'limit' };
      case 'full':
        return { width: 1600, height: 1600, quality: 95, format: 'auto', crop: 'limit' };
    }
  }

  static buildTransformations(options: CloudinaryImageOptions): string {
    const transforms = [];
    
    if (options.width) transforms.push(`w_${options.width}`);
    if (options.height) transforms.push(`h_${options.height}`);
    if (options.quality) transforms.push(`q_${options.quality}`);
    if (options.format) transforms.push(`f_${options.format}`);
    if (options.crop) transforms.push(`c_${options.crop}`);
    
    // Add auto optimizations
    transforms.push('fl_progressive', 'fl_immutable_cache');
    
    return transforms.join(',');
  }
}
