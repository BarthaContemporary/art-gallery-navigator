
import { CloudinaryUrlOptimizer } from "./cloudinary/url-optimizer";
import { CloudinaryProcessingStatus } from "./cloudinary/processing-status";
import { CloudinaryStorageUtils } from "./cloudinary/storage-utils";
import { CloudinaryBestUrlResolver } from "./cloudinary/best-url-resolver";
import { EnhancedCloudinaryResolver } from "./cloudinary/enhanced-url-resolver";
import type { CloudinaryImageOptions, ImageProcessingStatus, ImageTier } from "./cloudinary/types";

export class CloudinaryImageService {
  // Re-export types for backward compatibility
  static isCloudinaryConfigured = CloudinaryUrlOptimizer.isCloudinaryConfigured;
  static getOptimizedUrl = CloudinaryUrlOptimizer.getOptimizedUrl;
  static getDefaultOptionsForTier = CloudinaryUrlOptimizer.getDefaultOptionsForTier;
  static buildTransformations = CloudinaryUrlOptimizer.buildTransformations;
  
  static analyzeProcessingStatus = CloudinaryProcessingStatus.analyzeProcessingStatus;
  static triggerProcessing = CloudinaryProcessingStatus.triggerProcessing;
  
  static getSupabaseStorageUrl = CloudinaryStorageUtils.getSupabaseStorageUrl;
  static getOptimizedStorageUrl = CloudinaryStorageUtils.getOptimizedStorageUrl;
  
  static getBestAvailableUrl = CloudinaryBestUrlResolver.getBestAvailableUrl;
  static getBestImageUrl = CloudinaryBestUrlResolver.getBestImageUrl;
  static needsReprocessing = CloudinaryBestUrlResolver.needsReprocessing;
  
  // Enhanced Phase 3 & 4 methods
  static resolveImageUrl = EnhancedCloudinaryResolver.resolveImageUrl;
  static getHealthStatus = EnhancedCloudinaryResolver.getHealthStatus;
  static clearCache = EnhancedCloudinaryResolver.clearCache;
  static preloadImage = EnhancedCloudinaryResolver.preloadImage;
}

// Re-export types for backward compatibility
export type { CloudinaryImageOptions, ImageProcessingStatus, ImageTier };
